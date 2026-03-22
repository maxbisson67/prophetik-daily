// functions/firstGoalChallenge/repairFirstGoalGame.js
import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue, logger } from "../utils.js";

const FIRST_GOAL_GAMES_COL = "nhl_first_goal_games";
const REVEAL_DELAY_SECONDS = 90;
const FINAL_REVIEW_DELAY_SECONDS = 300;

function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function timeInPeriodToSeconds(s) {
  if (!s || typeof s !== "string") return null;
  const [mmS, ssS] = s.split(":").map((x) => x.trim());
  const mm = toInt(mmS, null);
  const ss = toInt(ssS, null);
  if (mm == null || ss == null) return null;
  return mm * 60 + ss;
}

function isShootoutGoal(goal) {
  const pt = String(goal?.periodType || "").toUpperCase();
  return pt === "SO";
}

function isValidGoal(goal) {
  if (!goal) return false;
  if (isShootoutGoal(goal)) return false;
  if (!goal?.scoringPlayerId && !goal?.scoringPlayerName) return false;
  return true;
}

async function computeFirstValidGoalFromGoals(gameId) {
  logger.info("[FG-M] computeFirstValidGoalFromGoals enter", { gameId });

  const goalsRef = db.collection("nhl_live_games").doc(String(gameId)).collection("goals");

  logger.info("[FG-M] before goalsRef.get()", { gameId });
  const snap = await goalsRef.get();
  logger.info("[FG-M] after goalsRef.get()", { gameId, empty: snap.empty, size: snap.size });

  if (snap.empty) return null;

  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(isValidGoal);

  logger.info("[FG-M] valid goal rows", { gameId, count: rows.length });

  if (!rows.length) return null;

  rows.sort((a, b) => {
    const pa = toInt(a.period, 99);
    const pb = toInt(b.period, 99);
    if (pa !== pb) return pa - pb;

    const sa = timeInPeriodToSeconds(a.timeInPeriod) ?? 999999;
    const sb = timeInPeriodToSeconds(b.timeInPeriod) ?? 999999;
    if (sa !== sb) return sa - sb;

    return String(a.id).localeCompare(String(b.id));
  });

  const first = rows[0];

  logger.info("[FG-M] first valid goal found", {
    gameId,
    goalId: String(first.id),
    scoringPlayerId: first.scoringPlayerId ? String(first.scoringPlayerId) : null,
  });

  return {
    goalId: String(first.id),
    scoringPlayerId: first.scoringPlayerId ? String(first.scoringPlayerId) : null,
    scoringPlayerName: first.scoringPlayerName || null,
    teamAbbr: first.teamAbbr || null,
    period: toInt(first.period, null),
    timeInPeriod: first.timeInPeriod || null,
    periodType: first.periodType || null,
  };
}

export async function repairFirstGoalGame(gameId, opts = {}) {
  const gid = String(gameId || "").trim();
  if (!gid) {
    throw new Error("repairFirstGoalGame: gameId manquant");
  }

  logger.info("[FG-M] repair start", { gameId: gid, opts });

  const now = new Date();
  const revealDelay = Number(opts.revealDelaySeconds ?? REVEAL_DELAY_SECONDS);
  const finalDelay = Number(opts.finalReviewDelaySeconds ?? FINAL_REVIEW_DELAY_SECONDS);

  logger.info("[FG-M] before computeFirstValidGoalFromGoals", { gameId: gid });
  const first = await computeFirstValidGoalFromGoals(gid);
  logger.info("[FG-M] after computeFirstValidGoalFromGoals", { gameId: gid, first: first || null });

  const fgRef = db.collection(FIRST_GOAL_GAMES_COL).doc(gid);

  if (!first) {
    logger.info("[FG-M] no first valid goal, writing none", { gameId: gid });

    await fgRef.set(
      {
        gameId: gid,
        status: "none",
        candidate: FieldValue.delete(),
        revealAt: FieldValue.delete(),
        finalReviewAt: FieldValue.delete(),
        provisionalAt: FieldValue.delete(),
        confirmedAt: FieldValue.delete(),
        result: FieldValue.delete(),
        message: "Réparation: aucun premier but valide trouvé.",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("[FG-M] wrote none successfully", { gameId: gid });
    return { ok: true, gameId: gid, repaired: false, reason: "no_valid_goal" };
  }

  const revealAt = new Date(now.getTime() + revealDelay * 1000);
  const finalReviewAt = new Date(now.getTime() + finalDelay * 1000);

  logger.info("[FG-M] writing pending candidate", {
    gameId: gid,
    goalId: first.goalId,
    scoringPlayerId: first.scoringPlayerId || null,
  });

  await fgRef.set(
    {
      gameId: gid,
      status: "pending",
      revealAt: Timestamp.fromDate(revealAt),
      finalReviewAt: Timestamp.fromDate(finalReviewAt),
      candidate: {
        goalId: String(first.goalId),
        scoringPlayerId: first.scoringPlayerId || null,
        scoringPlayerName: first.scoringPlayerName || null,
        teamAbbr: first.teamAbbr || null,
        period: first.period ?? null,
        timeInPeriod: first.timeInPeriod || null,
        periodType: first.periodType || null,
        observedAt: FieldValue.serverTimestamp(),
        revealAfterSeconds: revealDelay,
      },
      provisionalAt: FieldValue.delete(),
      confirmedAt: FieldValue.delete(),
      result: FieldValue.delete(),
      message: "Réparation manuelle: nouveau candidat premier but détecté.",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("[FG-M] repair success", { gameId: gid });

  return {
    ok: true,
    gameId: gid,
    repaired: true,
    candidate: first,
    revealAt: revealAt.toISOString(),
    finalReviewAt: finalReviewAt.toISOString(),
  };
}