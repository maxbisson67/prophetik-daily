// functions/ingest.js
// Live scoring TS — NHL (buts/passes) et MLB (hits/RBI/HR)
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  db,
  FieldValue,
  logger,
  apiWebSchedule,
  readTS,
} from "./utils.js";
import { appYmd } from "./ProphetikDate.js";
import {
  aggregateMlbDayBattingStats,
  updateMlbParticipationLivePoints,
} from "./defis/mlbDefiLiveStats.js";

async function getGamesForYmdCached(ymd, cache) {
  if (cache.has(ymd)) return cache.get(ymd);

  const sched = await apiWebSchedule(ymd);
  const day = Array.isArray(sched?.gameWeek)
    ? sched.gameWeek.find((d) => d?.date === ymd)
    : null;

  const games = day
    ? day.games || []
    : Array.isArray(sched?.games)
    ? sched.games
    : [];

  cache.set(ymd, games);
  return games;
}

function cleanObj(mapOrObj) {
  const entries =
    mapOrObj instanceof Map
      ? Array.from(mapOrObj.entries())
      : Object.entries(mapOrObj || {});
  return Object.fromEntries(entries.filter(([, v]) => Number(v) > 0));
}

async function resolveDefiSport(defi) {
  const explicit = String(defi?.sport || defi?.poolSport || "").toUpperCase();
  if (explicit === "MLB" || explicit === "NHL") return explicit;

  const groupId = String(defi?.groupId || "").trim();
  if (!groupId) return "NHL";

  const g = await db.doc(`groups/${groupId}`).get();
  return String(g.data()?.sport || "NHL").toUpperCase();
}

async function ingestNhlDefiStats(docSnap, ymd, schedCache) {
  const games = await getGamesForYmdCached(ymd, schedCache);
  const gameIds = games
    .map((g) => g.id)
    .filter(Boolean)
    .map((id) => String(id));

  if (!gameIds.length) return;

  const GOAL_POINTS = 1;
  const ASSIST_POINTS = 1;

  const goalsByPlayer = new Map();
  const assistsByPlayer = new Map();
  const pointsByPlayer = new Map();

  const inc = (m, id, d = 1) => {
    if (!id) return;
    const key = String(id);
    m.set(key, (m.get(key) || 0) + d);
  };

  for (const gid of gameIds) {
    try {
      const gameRef = db.collection("nhl_live_games").doc(String(gid));
      const goalsSnap = await gameRef.collection("goals").get();

      logger.info("[runIngestStatsForDate] goals snapshot", {
        ymd,
        gameId: gid,
        goals: goalsSnap.size,
      });

      for (const goalDoc of goalsSnap.docs) {
        const g = goalDoc.data() || {};

        const scorerId = g.scoringPlayerId || null;
        const a1 = g.assist1PlayerId || null;
        const a2 = g.assist2PlayerId || null;

        if (scorerId) {
          inc(goalsByPlayer, scorerId, 1);
          inc(pointsByPlayer, scorerId, GOAL_POINTS);
        }
        if (a1) {
          inc(assistsByPlayer, a1, 1);
          inc(pointsByPlayer, a1, ASSIST_POINTS);
        }
        if (a2) {
          inc(assistsByPlayer, a2, 1);
          inc(pointsByPlayer, a2, ASSIST_POINTS);
        }
      }
    } catch (e) {
      logger.warn("[runIngestStatsForDate] read goals failed", {
        ymd,
        gameId: gid,
        error: String(e?.message || e),
      });
    }
  }

  const liveRef = docSnap.ref.collection("live").doc("stats");

  const goalsObj = cleanObj(goalsByPlayer);
  const assistsObj = cleanObj(assistsByPlayer);
  const pointsObj = cleanObj(pointsByPlayer);

  const bw = db.bulkWriter();

  bw.set(
    liveRef,
    {
      playerGoals: goalsObj,
      playerAssists: assistsObj,
      playerPoints: pointsObj,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false }
  );

  const parts = await docSnap.ref.collection("participations").get();
  for (const pSnap of parts.docs) {
    const p = pSnap.data() || {};
    const picks = Array.isArray(p.picks) ? p.picks : [];
    let pts = 0;

    for (const pick of picks) {
      const raw =
        pick?.playerId ?? pick?.id ?? pick?.nhlId ?? pick?.player?.id;
      if (!raw) continue;
      const key = String(raw).trim();
      pts += Number(pointsObj[key] ?? 0);
    }

    bw.update(pSnap.ref, {
      livePoints: pts,
      liveUpdatedAt: FieldValue.serverTimestamp(),
    });
  }

  await bw.close();
}

async function ingestMlbDefiStats(docSnap, ymd) {
  const stats = await aggregateMlbDayBattingStats(ymd);
  const liveRef = docSnap.ref.collection("live").doc("stats");

  await liveRef.set(
    {
      ...stats,
      playerGoals: stats.playerHits,
      playerAssists: stats.playerRbi,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false }
  );

  await updateMlbParticipationLivePoints(docSnap.ref, stats.playerPoints);
}

export async function runIngestStatsForDate() {
  logger.info("[runIngestStatsForDate] tick", {
    at: new Date().toISOString(),
  });

  const snap = await db
    .collection("defis")
    .where("status", "in", ["live", "awaiting_result", "open"])
    .get();

  const schedCache = new Map();

  for (const docSnap of snap.docs) {
    const defi = docSnap.data() || {};

    const ymd =
      typeof defi.gameDate === "string"
        ? defi.gameDate.slice(0, 10)
        : defi.gameDate
        ? appYmd(readTS(defi.gameDate))
        : null;

    if (!ymd) continue;

    try {
      const sport = await resolveDefiSport(defi);

      if (sport === "MLB") {
        await ingestMlbDefiStats(docSnap, ymd);
      } else {
        await ingestNhlDefiStats(docSnap, ymd, schedCache);
      }
    } catch (e) {
      logger.warn("[runIngestStatsForDate] defi failed", {
        defiId: docSnap.id,
        ymd,
        error: String(e?.message || e),
      });
    }
  }

  logger.info("[runIngestStatsForDate] done");
}

export const ingestStatsForDate = onCall(async () => {
  await runIngestStatsForDate();
  return { ok: true };
});

export const ingestStatsForDateCron = onSchedule(
  {
    schedule: "*/1 * * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    await runIngestStatsForDate();
  }
);

export const syncDefiLiveScores = ingestStatsForDateCron;
