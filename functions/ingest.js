// functions/ingest.js
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

/**
 * Récupère la liste des matchs NHL pour un YMD donné via le schedule officiel.
 * Utilise un petit cache en mémoire par exécution pour éviter de rappeler
 * plusieurs fois apiWebSchedule sur la même date.
 */
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

export async function runIngestStatsForDate() {
  logger.info("[runIngestStatsForDate] tick", {
    at: new Date().toISOString(),
  });

  // Tous les défis encore "vivants"
  const snap = await db
    .collection("defis")
    .where("status", "in", ["live", "awaiting_result", "open"])
    .get();

  // Cache local du schedule par journée
  const schedCache = new Map();

  for (const docSnap of snap.docs) {
    const defi = docSnap.data() || {};

    // YMD de ce défi
    const ymd =
      typeof defi.gameDate === "string"
      ? defi.gameDate.slice(0, 10)          // "YYYY-MM-DD..."
      : defi.gameDate
      ? appYmd(readTS(defi.gameDate))       // Timestamp → Date → APP_TZ YMD
      : null;

    if (!ymd) continue;

    // Matches NHL de ce YMD (via schedule, avec cache)
    const games = await getGamesForYmdCached(ymd, schedCache);
    const gameIds = games
      .map((g) => g.id)
      .filter(Boolean)
      .map((id) => String(id));

    if (!gameIds.length) continue;

    const GOAL_POINTS = 1;
    const ASSIST_POINTS = 1;

    const goalsByPlayer = new Map();   // playerId -> nb buts
    const assistsByPlayer = new Map(); // playerId -> nb passes
    const pointsByPlayer = new Map();  // playerId -> total points

    const inc = (m, id, d = 1) => {
      if (!id) return;
      const key = String(id);
      m.set(key, (m.get(key) || 0) + d);
    };

    // 🔁 Pour chaque match → lire les buts depuis nhl_live_games/{gameId}/goals
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

    // ✅ Écriture des stats live globales pour ce défi
    const liveRef = docSnap.ref.collection("live").doc("stats");

    const goalsObj = Object.fromEntries(goalsByPlayer);
    const assistsObj = Object.fromEntries(assistsByPlayer);
    const pointsObj = Object.fromEntries(pointsByPlayer);

    const bw = db.bulkWriter();

    bw.set(
      liveRef,
      {
        playerGoals: goalsObj,
        playerAssists: assistsObj,
        playerPoints: pointsObj,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ Mise à jour des livePoints pour chaque participant
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

  logger.info("[runIngestStatsForDate] done");
}

export const ingestStatsForDate = onCall(async () => {
  await runIngestStatsForDate();
  return { ok: true };
});

export const ingestStatsForDateCron = onSchedule(
  {
    schedule: "*/2 * * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    await runIngestStatsForDate();
  }
);

// alias historique
export const syncDefiLiveScores = ingestStatsForDateCron;