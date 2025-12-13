// functions/reconcileLive.js
import { db, logger, apiWebPbp } from "./utils.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";

function buildTalliesFromPbpPlays(plays) {
  const goals = {};
  const assists = {};
  const points = {};
  const inc = (map, k, d = 1) => {
    if (!k) return;
    const key = String(k);
    map[key] = (map[key] || 0) + d;
  };

  for (const p of Array.isArray(plays) ? plays : []) {
    const typeKey = String(p?.typeDescKey || "").toLowerCase();
    const typeCode = Number(p?.typeCode);
    const isGoal = typeKey === "goal" || typeCode === 505;
    if (!isGoal) continue;

    // 🚫 Exclure buts en fusillade (shootout)
    const periodType = String(p?.periodDescriptor?.periodType || "").toUpperCase();
    if (periodType === "SO") continue;

    const scorerId = det.scoringPlayerId || det.playerId || null;
    const a1 = det.assist1PlayerId || null;
    const a2 = det.assist2PlayerId || null;
    if (scorerId) { inc(goals, scorerId, 1); inc(points, scorerId, 1); }
    if (a1) { inc(assists, a1, 1); inc(points, a1, 1); }
    if (a2) { inc(assists, a2, 1); inc(points, a2, 1); }
  }

  return { goals, assists, points };
}

export const reconcileLiveManual = onCall(async (req) => {
  const { defiId, gameIds } = req.data || {};
  if (!defiId || !Array.isArray(gameIds) || gameIds.length === 0) {
    throw new Error("Missing defiId or gameIds[]");
  }
  const result = await reconcileLive(defiId, gameIds);
  return { ok: true, result };
});

export async function reconcileLive(defiId, gameIds) {
  logger.info("reconcileLive: start", { defiId, games: gameIds });

  const allPlays = [];
  for (const gid of gameIds) {
    try {
      const pbp = await apiWebPbp(gid);
      const plays = Array.isArray(pbp?.plays) ? pbp.plays : [];
      logger.info("reconcileLive: fetched PBP", { gameId: gid, plays: plays.length });
      allPlays.push(...plays);
    } catch (e) {
      logger.warn("reconcileLive: fetch PBP failed", { gameId: gid, error: String(e?.message || e) });
    }
  }

  const { goals, assists, points } = buildTalliesFromPbpPlays(allPlays);
  const clean = (m) => Object.fromEntries(Object.entries(m || {}).filter(([, v]) => v > 0));

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
    goalsCountPlayers: Object.keys(goals).length,
    assistsCountPlayers: Object.keys(assists).length,
    pointsCountPlayers: Object.keys(points).length,
  };
  logger.info("reconcileLive: done", { defiId, ...res });
  return res;
}