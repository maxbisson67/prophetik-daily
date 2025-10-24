// functions/ingest.js
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, FieldValue, logger, apiWebSchedule, apiWebPbp, readTS, toYMD } from "./utils.js";

async function runIngestStatsForDate() {
  logger.info("[runIngestStatsForDate] tick", { at: new Date().toISOString() });

  const snap = await db.collection("defis").where("status", "in", ["live","awaiting_result","open"]).get();
  for (const docSnap of snap.docs) {
    const defi = docSnap.data() || {};
    const ymd = typeof defi.gameDate === "string" ? defi.gameDate : (defi.gameDate ? toYMD(readTS(defi.gameDate)) : null);
    if (!ymd) continue;

    const sched = await apiWebSchedule(ymd);
    const day   = Array.isArray(sched?.gameWeek) ? sched.gameWeek.find(d => d?.date === ymd) : null;
    const games = day ? (day.games || []) : (Array.isArray(sched?.games) ? sched.games : []);
    const gameIds = games.map(g => g.id).filter(Boolean);
    if (!gameIds.length) continue;

    const GOAL_POINTS = 1, ASSIST_POINTS = 1;
    const goalsByPlayer  = new Map();
    const pointsByPlayer = new Map();
    const inc = (m, id, d=1) => { if (!id) return; m.set(String(id), (m.get(String(id))||0) + d); };

    for (const gid of gameIds) {
      let pbp; try { pbp = await apiWebPbp(gid); } catch { continue; }
      const plays = Array.isArray(pbp?.plays) ? pbp.plays : [];
      for (const p of plays) {
        const isGoal = String(p?.typeDescKey||"").toLowerCase() === "goal" || Number(p?.typeCode) === 505;
        if (!isGoal) continue;
        const det = p?.details || {};
        const scorerId = det.scoringPlayerId || det.playerId || null;
        const a1 = det.assist1PlayerId || null;
        const a2 = det.assist2PlayerId || null;
        if (scorerId) { inc(goalsByPlayer, scorerId, 1); inc(pointsByPlayer, scorerId, GOAL_POINTS); }
        if (a1) inc(pointsByPlayer, a1, ASSIST_POINTS);
        if (a2) inc(pointsByPlayer, a2, ASSIST_POINTS);
      }
    }

    const liveRef   = docSnap.ref.collection("live").doc("stats");
    const goalsObj  = Object.fromEntries(goalsByPlayer);
    const pointsObj = Object.fromEntries(pointsByPlayer);

    const bw = db.bulkWriter();
    bw.set(liveRef, { playerGoals: goalsObj, playerPoints: pointsObj, updatedAt: FieldValue.serverTimestamp() }, { merge:true });

    const parts = await docSnap.ref.collection("participations").get();
    for (const pSnap of parts.docs) {
      const p = pSnap.data() || {};
      const picks = Array.isArray(p.picks) ? p.picks : [];
      let pts = 0;
      for (const pick of picks) {
        const raw = pick?.playerId ?? pick?.id ?? pick?.nhlId ?? pick?.player?.id;
        if (!raw) continue;
        const key = String(raw).trim();
        pts += Number(pointsObj[key] ?? 0);
      }
      bw.update(pSnap.ref, { livePoints: pts, liveUpdatedAt: FieldValue.serverTimestamp() });
    }
    await bw.close();
  }
  logger.info("[runIngestStatsForDate] done");
}

export const ingestStatsForDate = onCall(async () => { await runIngestStatsForDate(); return { ok:true }; });

export const ingestStatsForDateCron = onSchedule(
  { schedule: "*/2 * * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => { await runIngestStatsForDate(); }
);

// alias historique
export const syncDefiLiveScores = ingestStatsForDateCron;