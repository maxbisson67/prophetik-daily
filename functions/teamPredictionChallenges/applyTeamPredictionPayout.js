import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { recordParticipantProgressionSafe } from "../achievements/achievementService.js";
import { TP_DEFAULT_SCORING, safeUpper } from "./tpGameSources.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";

function toNumber(v, def = 0) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function readScoringConfig(ch = {}) {
  const scoring = ch.scoring || {};
  return {
    winnerBasePoints: toNumber(
      scoring.winnerBasePoints,
      TP_DEFAULT_SCORING.winnerBasePoints
    ),
    exactScoreBonusPoints: toNumber(
      scoring.exactScoreBonusPoints,
      TP_DEFAULT_SCORING.exactScoreBonusPoints
    ),
  };
}

function scoreEntry(entry = {}, official = {}, scoring = {}) {
  const officialWinner = safeUpper(official?.winnerAbbr);
  const officialAwayScore = toNumber(official?.awayScore, null);
  const officialHomeScore = toNumber(official?.homeScore, null);

  const winnerCorrect = safeUpper(entry?.winnerAbbr) === officialWinner;

  const exactScoreCorrect =
    winnerCorrect &&
    toNumber(entry?.predictedAwayScore, null) === officialAwayScore &&
    toNumber(entry?.predictedHomeScore, null) === officialHomeScore;

  let points = 0;
  if (winnerCorrect) {
    points += scoring.winnerBasePoints;
  }
  if (winnerCorrect && exactScoreCorrect) {
    points += scoring.exactScoreBonusPoints;
  }

  return {
    winnerCorrect,
    exactScoreCorrect,
    points,
    won: winnerCorrect,
    isPerfectPick: winnerCorrect && exactScoreCorrect,
    payout: points,
  };
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
        const scoring = readScoringConfig(ch);

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
        const entriesQuery = db.collection(
          `team_prediction_challenges/${challengeId}/entries`
        );
        const entriesSnap = await tx.get(entriesQuery);
        const entryDocs = entriesSnap.docs || [];

        const scoredEntries = entryDocs.map((d) => {
          const entry = d.data() || {};
          const scored = scoreEntry(entry, official, scoring);
          return { uid: String(d.id), scored };
        });

        const winnerEntries = scoredEntries.filter((row) => row.scored.winnerCorrect);
        const winnerUids = winnerEntries.map((row) => row.uid);
        const payoutTotal = scoredEntries.reduce((sum, row) => sum + row.scored.points, 0);

        for (const row of scoredEntries) {
          const entryRef = db.doc(
            `team_prediction_challenges/${challengeId}/entries/${row.uid}`
          );

          tx.set(
            entryRef,
            {
              winnerCorrect: row.scored.winnerCorrect,
              exactScoreCorrect: row.scored.exactScoreCorrect,
              points: row.scored.points,
              won: row.scored.won,
              isPerfectPick: row.scored.isPerfectPick,
              payout: row.scored.payout,
              finalizedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        tx.set(
          chRef,
          {
            payoutApplied: true,
            payoutAppliedAt: FieldValue.serverTimestamp(),
            payoutAppliedReason: "scoring-applied",
            payoutTotal,
            winnersCount: winnerUids.length,
            winnersPreviewUids: winnerUids.slice(0, 10),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

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
          payoutTotal,
          winnerProgression: winnerEntries.map((row) => ({
            uid: row.uid,
            isExactScore: row.scored.exactScoreCorrect,
          })),
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
