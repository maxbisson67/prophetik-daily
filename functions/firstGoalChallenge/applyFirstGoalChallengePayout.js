// functions/firstGoalChallenge/applyFirstGoalChallengePayout.js
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { recordParticipantProgressionSafe } from "../achievements/achievementService.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";

export const applyFirstGoalChallengePayout = onDocumentWritten(
  {
    document: "first_goal_challenges/{challengeId}",
    region: REGION,
  },
  async (event) => {
    const challengeId = String(event.params.challengeId || "");

    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    if (!challengeId || !after) return;

    const beforeStatus = String(before?.status || "");
    const afterStatus = String(after?.status || "");

    if (afterStatus !== "decided") return;
    if (beforeStatus === "decided" && after?.payoutAppliedAt) return;

    try {
      const result = await db.runTransaction(async (tx) => {
        const chRef = db.doc(`first_goal_challenges/${challengeId}`);
        const chSnap = await tx.get(chRef);
        if (!chSnap.exists) return { ok: false, reason: "missing-challenge" };

        const ch = chSnap.data() || {};

        if (ch.payoutAppliedAt) {
          return { ok: true, skipped: true, reason: "already-paid" };
        }

        if (String(ch.status || "") !== "decided") {
          return { ok: true, skipped: true, reason: "not-decided" };
        }

        const groupId = ch.groupId ? String(ch.groupId) : null;
        const winnerPlayerId = ch?.firstRbi?.playerId
          ? String(ch.firstRbi.playerId)
          : ch?.firstGoal?.playerId
          ? String(ch.firstGoal.playerId)
          : null;

        if (!groupId || !winnerPlayerId) {
          tx.set(
            chRef,
            {
              payoutAppliedAt: FieldValue.serverTimestamp(),
              payoutApplied: false,
              payoutAppliedReason: "missing-group-or-winner-player",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          return { ok: true, skipped: true, reason: "missing-group-or-winner-player" };
        }

        const winnersQuery = db
          .collection(`first_goal_challenges/${challengeId}/entries`)
          .where("playerId", "==", winnerPlayerId);

        const winnersSnap = await tx.get(winnersQuery);
        const winnerDocs = winnersSnap.docs || [];
        const winnerUids = winnerDocs.map((d) => String(d.id));

        if (!winnerUids.length) {
          tx.set(
            chRef,
            {
              payoutAppliedAt: FieldValue.serverTimestamp(),
              payoutApplied: false,
              payoutAppliedReason: "no-winners",
              payoutTotal: 0,
              winnerShares: {},
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          return { ok: true, skipped: true, reason: "no-winners" };
        }

        const winnerShares = {};
        winnerUids.forEach((uid) => {
          winnerShares[uid] = 0;
        });

        for (const uid of winnerUids) {
          const entryRef = db.doc(`first_goal_challenges/${challengeId}/entries/${uid}`);

          tx.set(
            entryRef,
            {
              won: true,
              payout: 0,
              finalizedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        tx.set(
          chRef,
          {
            payoutAppliedAt: FieldValue.serverTimestamp(),
            payoutApplied: true,
            payoutTotal: 0,
            winnerShares,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const groupRef = db.doc(`groups/${groupId}`);
        tx.set(
          groupRef,
          {
            leaderboardSeasonDirty: true,
            leaderboardSeasonDirtyAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return {
          ok: true,
          skipped: false,
          winners: winnerUids.length,
          winnerUids,
          payoutTotal: 0,
        };
      });

      if (result?.ok && !result?.skipped && Array.isArray(result.winnerUids)) {
        for (const winnerUid of result.winnerUids) {
          await recordParticipantProgressionSafe(winnerUid, {
            challengeType: "FGC",
            countParticipation: false,
            isFGCWin: true,
          });
        }
      }

      logger.info("[FGC payout] done", {
        challengeId,
        ...result,
      });
    } catch (e) {
      logger.error("[FGC payout] failed", {
        challengeId,
        err: String(e?.message || e),
      });
    }
  }
);
