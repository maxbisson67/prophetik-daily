import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { recordParticipantProgressionSafe } from "../achievements/achievementService.js";
import { safeUpper } from "../teamPredictionChallenges/tpGameSources.js";
import { readScoringConfig, scorePick } from "./tpBundleScoring.js";
import { computeBundleStatus } from "./tpBundleUtils.js";

const db = getFirestore();

export async function applySlotPayoutForBundle({ bundleId, gameId }) {
  const result = await db.runTransaction(async (tx) => {
    const bundleRef = db.doc(`team_prediction_bundles/${bundleId}`);
    const bundleSnap = await tx.get(bundleRef);

    if (!bundleSnap.exists) {
      return { ok: false, reason: "missing-bundle" };
    }

    const bundle = bundleSnap.data() || {};
    const groupId = bundle.groupId ? String(bundle.groupId) : null;
    const games = Array.isArray(bundle.games) ? [...bundle.games] : [];
    const slotIndex = games.findIndex((g) => String(g.gameId) === String(gameId));

    if (slotIndex < 0) {
      return { ok: false, reason: "missing-slot" };
    }

    const slot = games[slotIndex];
    if (slot.payoutApplied) {
      return { ok: true, skipped: true, reason: "already-paid" };
    }

    if (String(slot.status || "").toLowerCase() !== "decided") {
      return { ok: true, skipped: true, reason: "slot-not-decided" };
    }

    const official = slot.officialResult || {};
    const scoring = readScoringConfig(bundle);

    if (
      !groupId ||
      !safeUpper(official?.winnerAbbr) ||
      official.awayScore == null ||
      official.homeScore == null ||
      !safeUpper(official?.outcome)
    ) {
      games[slotIndex] = {
        ...slot,
        payoutApplied: false,
        payoutAppliedAt: FieldValue.serverTimestamp(),
        payoutAppliedReason: "missing-official-result",
      };

      tx.set(
        bundleRef,
        {
          games,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true, skipped: true, reason: "missing-official-result" };
    }

    const entriesSnap = await tx.get(
      db.collection(`team_prediction_bundles/${bundleId}/entries`)
    );

    const winnerProgression = [];
    let slotPayoutTotal = 0;

    for (const entryDoc of entriesSnap.docs) {
      const entry = entryDoc.data() || {};
      const pick = entry?.picks?.[gameId];

      if (!pick) continue;

      const scored = scorePick(pick, official, scoring);
      slotPayoutTotal += scored.points;

      if (scored.winnerCorrect) {
        winnerProgression.push({
          uid: String(entryDoc.id),
          isExactScore: scored.exactScoreCorrect,
        });
      }

      tx.set(
        entryDoc.ref,
        {
          [`pickResults.${gameId}`]: {
            winnerCorrect: scored.winnerCorrect,
            exactScoreCorrect: scored.exactScoreCorrect,
            points: scored.points,
            won: scored.won,
            isPerfectPick: scored.isPerfectPick,
            payout: scored.payout,
            finalizedAt: FieldValue.serverTimestamp(),
          },
          totalPoints: FieldValue.increment(scored.points),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    games[slotIndex] = {
      ...slot,
      payoutApplied: true,
      payoutAppliedAt: FieldValue.serverTimestamp(),
      payoutAppliedReason: "scoring-applied",
      slotPayoutTotal,
    };

    const allSlotsPaid = games.every((g) => g.payoutApplied || String(g.status) !== "decided");
    const bundleDecided = computeBundleStatus(games) === "decided";

    tx.set(
      bundleRef,
      {
        games,
        status: computeBundleStatus(games),
        payoutTotal: FieldValue.increment(slotPayoutTotal),
        ...(allSlotsPaid && bundleDecided
          ? {
              payoutApplied: true,
              payoutAppliedAt: FieldValue.serverTimestamp(),
              payoutAppliedReason: "all-slots-scored",
            }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      db.doc(`groups/${groupId}`),
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
      slotPayoutTotal,
      winnerProgression,
    };
  });

  if (result?.ok && !result?.skipped && Array.isArray(result.winnerProgression)) {
    for (const winner of result.winnerProgression) {
      await recordParticipantProgressionSafe(winner.uid, {
        challengeType: "TP",
        countParticipation: false,
        isCorrectPrediction: true,
        isExactScore: winner.isExactScore,
      });
    }
  }

  logger.info("[TP bundle payout] slot done", {
    bundleId,
    gameId,
    ...result,
  });

  return result;
}

export const applyTeamPredictionBundlePayout = applySlotPayoutForBundle;
