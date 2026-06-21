import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { recordParticipantProgressionSafe } from "../achievements/achievementService.js";
import { incrementLeaderboardTpSlotPoints } from "../leaderboard/incrementLeaderboardPoints.js";
import { safeUpper } from "../teamPredictionChallenges/tpGameSources.js";
import { readScoringConfig, scorePick } from "./tpBundleScoring.js";
import { computeBundleStatus } from "./tpBundleUtils.js";

const db = getFirestore();

function readPickResults(entry = {}) {
  const map = { ...(entry.pickResults || {}) };
  for (const [key, value] of Object.entries(entry)) {
    if (!key.startsWith("pickResults.")) continue;
    if (!value || typeof value !== "object") continue;
    map[key.slice("pickResults.".length)] = value;
  }
  return map;
}

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
        payoutAppliedAt: Timestamp.now(),
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
    const leaderboardUpdates = [];
    let slotPayoutTotal = 0;

    for (const entryDoc of entriesSnap.docs) {
      const entry = entryDoc.data() || {};
      const pick = entry?.picks?.[gameId];

      if (!pick) continue;

      const scored = scorePick(pick, official, scoring);
      slotPayoutTotal += scored.points;

      const priorPickResults = readPickResults(entry);
      const recordPlay = Object.keys(priorPickResults).length === 0;

      if (scored.winnerCorrect) {
        winnerProgression.push({
          uid: String(entryDoc.id),
          isExactScore: scored.exactScoreCorrect,
        });
      }

      leaderboardUpdates.push({
        uid: String(entryDoc.id),
        points: scored.points,
        won: scored.winnerCorrect,
        recordPlay,
      });

      const nextPickResults = {
        ...priorPickResults,
        [String(gameId)]: {
          winnerCorrect: scored.winnerCorrect,
          exactScoreCorrect: scored.exactScoreCorrect,
          points: scored.points,
          won: scored.won,
          isPerfectPick: scored.isPerfectPick,
          payout: scored.payout,
          finalizedAt: FieldValue.serverTimestamp(),
        },
      };

      tx.set(
        entryDoc.ref,
        {
          pickResults: nextPickResults,
          totalPoints: FieldValue.increment(scored.points),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    games[slotIndex] = {
      ...slot,
      payoutApplied: true,
      payoutAppliedAt: Timestamp.now(),
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
              payoutAppliedAt: Timestamp.now(),
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
      leaderboardUpdates,
      groupId,
      gameYmd: bundle.gameYmd,
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

  if (
    result?.ok &&
    !result?.skipped &&
    result.groupId &&
    Array.isArray(result.leaderboardUpdates)
  ) {
    for (const row of result.leaderboardUpdates) {
      try {
        await incrementLeaderboardTpSlotPoints({
          groupId: result.groupId,
          uid: row.uid,
          points: row.points,
          won: row.won,
          gameYmd: result.gameYmd,
          recordPlay: row.recordPlay,
        });
      } catch (e) {
        logger.error("[TP bundle payout] live leaderboard increment failed", {
          bundleId,
          gameId,
          uid: row.uid,
          err: String(e?.message || e),
        });
      }
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
