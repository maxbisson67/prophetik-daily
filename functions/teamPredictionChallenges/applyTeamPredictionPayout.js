// functions/teamPrediction/applyTeamPredictionPayout.js
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";
const TP_BASE_POINTS = 3;

function toNumber(v, def = 0) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function splitEven(total, n) {
  if (n <= 0 || !(total > 0)) {
    return Array.from({ length: Math.max(0, n) }, () => 0);
  }
  const base = Math.floor(total / n);
  let r = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < r ? base + 1 : base));
}

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function isPerfectPick(entry = {}, official = {}) {
  const predictedWinner = safeUpper(entry?.winnerAbbr);
  const predictedAwayScore = toNumber(entry?.predictedAwayScore, null);
  const predictedHomeScore = toNumber(entry?.predictedHomeScore, null);
  const predictedOutcome = safeUpper(entry?.predictedOutcome);

  const officialWinner = safeUpper(official?.winnerAbbr);
  const officialAwayScore = toNumber(official?.awayScore, null);
  const officialHomeScore = toNumber(official?.homeScore, null);
  const officialOutcome = safeUpper(official?.outcome);

  if (!predictedWinner || !officialWinner) return false;
  if (predictedAwayScore === null || officialAwayScore === null) return false;
  if (predictedHomeScore === null || officialHomeScore === null) return false;
  if (!predictedOutcome || !officialOutcome) return false;

  return (
    predictedWinner === officialWinner &&
    predictedAwayScore === officialAwayScore &&
    predictedHomeScore === officialHomeScore &&
    predictedOutcome === officialOutcome
  );
}

export const applyTeamPredictionPayout = onDocumentWritten(
  {
    document: "team_prediction_challenges/{challengeId}",
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
        const chRef = db.doc(`team_prediction_challenges/${challengeId}`);
        const chSnap = await tx.get(chRef);

        if (!chSnap.exists) {
          return { ok: false, reason: "missing-challenge" };
        }

        const ch = chSnap.data() || {};

        if (ch.payoutAppliedAt) {
          return { ok: true, skipped: true, reason: "already-paid" };
        }

        if (String(ch.status || "") !== "decided") {
          return { ok: true, skipped: true, reason: "not-decided" };
        }

        const groupId = ch.groupId ? String(ch.groupId) : null;
        const official = ch.officialResult || {};

        const officialWinner = safeUpper(official?.winnerAbbr);
        const officialAwayScore = toNumber(official?.awayScore, null);
        const officialHomeScore = toNumber(official?.homeScore, null);
        const officialOutcome = safeUpper(official?.outcome);

        if (
          !groupId ||
          !officialWinner ||
          officialAwayScore === null ||
          officialHomeScore === null ||
          !officialOutcome
        ) {
          tx.set(
            chRef,
            {
              payoutAppliedAt: FieldValue.serverTimestamp(),
              payoutApplied: false,
              payoutAppliedReason: "missing-group-or-official-result",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return {
            ok: true,
            skipped: true,
            reason: "missing-group-or-official-result",
          };
        }

        const groupRef = db.doc(`groups/${groupId}`);
        const groupSnap = await tx.get(groupRef);
        const group = groupSnap.exists ? groupSnap.data() || {} : {};

        // Valeur courante du TP pour ce groupe.
        // Si absente ou invalide, on repart à 3.
        const currentTpPot = Math.max(
          TP_BASE_POINTS,
          toNumber(group.tpBonus, TP_BASE_POINTS)
        );

        const entriesQuery = db.collection(
          `team_prediction_challenges/${challengeId}/entries`
        );
        const entriesSnap = await tx.get(entriesQuery);
        const entryDocs = entriesSnap.docs || [];

        const winners = entryDocs.filter((d) => {
          const entry = d.data() || {};
          return isPerfectPick(entry, official);
        });

        const winnerUids = winners.map((d) => String(d.id));

        // Aucun gagnant -> le prochain TP passe à +1
        if (!winnerUids.length) {
          for (const d of entryDocs) {
            const uid = String(d.id);
            const entryRef = db.doc(
              `team_prediction_challenges/${challengeId}/entries/${uid}`
            );

            tx.set(
              entryRef,
              {
                won: false,
                isPerfectPick: false,
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
              payoutApplied: false,
              payoutAppliedReason: "no-winners",
              payoutTotal: 0,
              bonusUsed: currentTpPot,
              jackpotCarryIn: currentTpPot,
              winnerShares: {},
              winnersCount: 0,
              winnersPreviewUids: [],
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          tx.set(
            groupRef,
            {
              tpBonus: currentTpPot + 1,
              tpBonusUpdatedAt: FieldValue.serverTimestamp(),
              tpBonusRolledFromChallengeId: challengeId,
              leaderboardSeasonDirty: true,
              leaderboardSeasonDirtyAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return {
            ok: true,
            skipped: false,
            winners: 0,
            payoutTotal: 0,
            nextTpBonus: currentTpPot + 1,
          };
        }

        // Gagnants -> partage égal de la valeur courante
        const shares = splitEven(currentTpPot, winnerUids.length);
        const winnerShares = {};

        winnerUids.forEach((uid, i) => {
          winnerShares[uid] = shares[i] || 0;
        });

        // Marquer toutes les entrées
        for (const d of entryDocs) {
          const uid = String(d.id);
          const entry = d.data() || {};
          const perfect = isPerfectPick(entry, official);
          const payout = winnerShares[uid] || 0;

          const entryRef = db.doc(
            `team_prediction_challenges/${challengeId}/entries/${uid}`
          );

          tx.set(
            entryRef,
            {
              won: perfect,
              isPerfectPick: perfect,
              payout,
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
            payoutAppliedReason: "winners-paid",
            payoutTotal: currentTpPot,
            bonusUsed: currentTpPot,
            jackpotCarryIn: currentTpPot,
            winnerShares,
            winnersCount: winnerUids.length,
            winnersPreviewUids: winnerUids,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Un TP a été remporté -> on repart à 3
        tx.set(
          groupRef,
          {
            tpBonus: TP_BASE_POINTS,
            tpBonusPaidAt: FieldValue.serverTimestamp(),
            tpBonusPaidChallengeId: challengeId,
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
          payoutTotal: currentTpPot,
          nextTpBonus: TP_BASE_POINTS,
        };
      });

      logger.info("[TP payout] done", {
        challengeId,
        ...result,
      });
    } catch (e) {
      logger.error("[TP payout] failed", {
        challengeId,
        err: String(e?.message || e),
      });
    }
  }
);