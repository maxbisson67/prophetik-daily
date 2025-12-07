// functions/reconcileLive.js
import { db, logger } from "./utils.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Construit les tallies (goals/assists/points) à partir d’une liste
 * de docs "goal" provenant de /nhl_live_games/{gameId}/goals.
 */
function buildTalliesFromGoalDocs(goalDocs) {
  const goals = {};
  const assists = {};
  const points = {};

  const inc = (map, k, d = 1) => {
    if (!k) return;
    const key = String(k);
    map[key] = (map[key] || 0) + d;
  };

  for (const g of Array.isArray(goalDocs) ? goalDocs : []) {
    if (!g || typeof g !== "object") continue;

    const scorerId = g.scoringPlayerId || null;
    const a1 = g.assist1PlayerId || null;
    const a2 = g.assist2PlayerId || null;

    if (scorerId) {
      inc(goals, scorerId, 1);
      inc(points, scorerId, 1);
    }
    if (a1) {
      inc(assists, a1, 1);
      inc(points, a1, 1);
    }
    if (a2) {
      inc(assists, a2, 1);
      inc(points, a2, 1);
    }
  }

  return { goals, assists, points };
}

export const reconcileLiveManual = onCall(async (req) => {
  const { defiId, gameIds } = req.data || {};
  if (!defiId || !Array.isArray(gameIds) || gameIds.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Missing defiId or non-empty gameIds[]"
    );
  }
  const result = await reconcileLive(defiId, gameIds);
  return { ok: true, result };
});

export async function reconcileLive(defiId, gameIds) {
  logger.info("reconcileLive: start", { defiId, games: gameIds });

  const allGoalDocs = [];

  for (const gidRaw of gameIds) {
    const gameId = String(gidRaw);
    try {
      const gameRef = db.collection("nhl_live_games").doc(gameId);
      const goalsSnap = await gameRef.collection("goals").get();

      logger.info("reconcileLive: fetched goals", {
        gameId,
        goals: goalsSnap.size,
      });

      goalsSnap.forEach((docSnap) => {
        const v = docSnap.data() || {};
        allGoalDocs.push(v);
      });
    } catch (e) {
      logger.warn("reconcileLive: read goals failed", {
        gameId,
        error: String(e?.message || e),
      });
    }
  }

  const { goals, assists, points } = buildTalliesFromGoalDocs(allGoalDocs);

  const clean = (m) =>
    Object.fromEntries(
      Object.entries(m || {}).filter(([, v]) => Number(v) > 0)
    );

  const ref = db.doc(`defis/${defiId}/live/stats`);
  await ref.set(
    {
      playerGoals: clean(goals),
      playerAssists: clean(assists),
      playerPoints: clean(points),
      updatedAt: new Date(),
    },
    { merge: false }
  );

  const res = {
    goalsCountPlayers: Object.keys(clean(goals)).length,
    assistsCountPlayers: Object.keys(clean(assists)).length,
    pointsCountPlayers: Object.keys(clean(points)).length,
  };
  logger.info("reconcileLive: done", { defiId, ...res });
  return res;
}