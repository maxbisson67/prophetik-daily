// functions/firstGoalChallenge/applyFirstGoalChallengePayout.js
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";

function toNumber(v, def = 0) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function splitEven(total, n) {
  if (n <= 0 || !(total > 0)) return Array.from({ length: Math.max(0, n) }, () => 0);
  const base = Math.floor(total / n);
  let r = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < r ? base + 1 : base));
}

function numOrNull(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

function readAnyBalance(doc) {
  return (
    numOrNull(doc?.credits?.balance) ??
    numOrNull(doc?.credits) ??
    numOrNull(doc?.credit) ??
    numOrNull(doc?.balance) ??
    0
  );
}

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
        const winnerPlayerId = ch?.firstGoal?.playerId ? String(ch.firstGoal.playerId) : null;

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

        const groupRef = db.doc(`groups/${groupId}`);
        const groupSnap = await tx.get(groupRef);
        const group = groupSnap.exists ? groupSnap.data() || {} : {};
        const bonusPot = Math.max(0, toNumber(group.fgcBonus, 0));

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
              bonusUsed: 0,
              winnerShares: {},
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          return { ok: true, skipped: true, reason: "no-winners" };
        }

        const shares = splitEven(bonusPot, winnerUids.length);
        const winnerShares = {};
        winnerUids.forEach((uid, i) => {
          winnerShares[uid] = shares[i] || 0;
        });

        const participantRefs = winnerUids.map((uid) => db.doc(`participants/${uid}`));
        const participantSnaps = await Promise.all(participantRefs.map((ref) => tx.get(ref)));

        const participants = winnerUids.map((uid, i) => {
          const snap = participantSnaps[i];
          const data = snap.exists ? snap.data() || {} : {};
          return {
            uid,
            ref: participantRefs[i],
            curBal: readAnyBalance(data),
            amount: winnerShares[uid] || 0,
          };
        });

        // -------- WRITES ONLY --------

        for (const p of participants) {
          const entryRef = db.doc(`first_goal_challenges/${challengeId}/entries/${p.uid}`);

          tx.set(
            entryRef,
            {
              won: true,
              payout: p.amount,
              finalizedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          if (p.amount > 0) {
            tx.set(
              p.ref,
              {
                "credits.balance": FieldValue.increment(p.amount),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            const logRef = p.ref.collection("credit_logs").doc();
            tx.set(logRef, {
              type: "fgc_bonus_payout",
              amount: p.amount,
              fromBalance: p.curBal,
              toBalance: p.curBal + p.amount,
              groupId,
              challengeId,
              challengeType: "first_goal",
              winnerPlayerId,
              winnerPlayerName: ch?.firstGoal?.playerName || null,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }

        tx.set(
          chRef,
          {
            payoutAppliedAt: FieldValue.serverTimestamp(),
            payoutApplied: true,
            payoutTotal: bonusPot,
            bonusUsed: bonusPot,
            winnerShares,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (bonusPot > 0) {
          tx.set(
            groupRef,
            {
              fgcBonus: 0,
              fgcBonusPaidAt: FieldValue.serverTimestamp(),
              fgcBonusPaidChallengeId: challengeId,
              leaderboardSeasonDirty: true,
              leaderboardSeasonDirtyAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          tx.set(
            groupRef,
            {
              leaderboardSeasonDirty: true,
              leaderboardSeasonDirtyAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        return {
          ok: true,
          skipped: false,
          winners: winnerUids.length,
          payoutTotal: bonusPot,
        };
      });

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