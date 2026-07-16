// functions/mlb/mlbLive.js
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, FieldValue, logger } from "../utils.js";
import { todayAppYmd, addDaysToYmd } from "../ProphetikDate.js";
import { shallowFieldsEqual } from "../shared/liveIngestCostUtils.js";
import {
  LIVE_LEAGUES,
  computeMlbDayMode,
  logLiveControlDecision,
  readLiveControl,
  shouldRefreshModeCheck,
  shouldRunHeavyIngest,
  writeLiveControl,
} from "../shared/liveControl.js";
import {
  compactMlbBoardEntry,
  upsertLiveBoard,
} from "../shared/liveBoard.js";
import {
  isWithinLiveCronSchedule,
  LIVE_CRON_SCHEDULE,
  LIVE_CRON_YESTERDAY_UNTIL_HOUR,
} from "../shared/liveCronGate.js";
import { fetchMlbLiveFeed } from "./mlbLiveFeed.js";
import {
  MLB_LIVE_DOC_COMPARE_KEYS,
  buildMlbLiveDocFromScheduleGame,
  extractScoringPlaysFromFeed,
  mergeMlbLiveFeedIntoDoc,
  needsMlbLiveFeed,
  shouldPollMlbGame,
} from "./mlbLiveGamesSchema.js";
import { invalidateMlbBvpCacheForFinalGame } from "./mlbBvpInvalidate.js";
import {
  handleMlbGamePostponed,
  shouldVoidChallengesForStatus,
} from "./mlbPostponedGameHandler.js";

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

function torontoCurrentHour() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      hour12: false,
      hour: "2-digit",
    }).formatToParts(new Date());
    const hStr = parts.find((p) => p.type === "hour")?.value;
    const hNum = hStr ? parseInt(hStr, 10) : 0;
    return Number.isNaN(hNum) ? 0 : hNum;
  } catch {
    return 0;
  }
}

async function loadScheduleGamesForYmd(ymd) {
  const compact = ymdCompact(ymd);
  if (!compact) return [];

  const snap = await db.collection("mlb_schedule_daily").doc(compact).collection("games").get();
  return snap.docs.map((d) => ({ gamePk: d.id, ...d.data() }));
}

async function upsertScoringPlays(gameRef, liveFeed, gamePk) {
  const plays = extractScoringPlaysFromFeed(liveFeed, gamePk);
  if (!plays.length) return 0;

  const seen = new Set();
  let written = 0;

  for (const play of plays) {
    const playId = String(play.playId || "");
    if (!playId || seen.has(playId)) continue;
    seen.add(playId);

    await gameRef.collection("scoring_plays").doc(playId).set(
      {
        ...play,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    written += 1;
  }

  // Ghost cleanup
  try {
    const existing = await gameRef.collection("scoring_plays").get();
    for (const docSnap of existing.docs) {
      if (!seen.has(docSnap.id)) {
        await docSnap.ref.delete();
      }
    }
  } catch (err) {
    logger.warn("[mlbLive] scoring_plays cleanup failed", {
      gamePk,
      error: err?.message || String(err),
    });
  }

  return written;
}

async function seedMlbLiveBoardFromScheduleOnly(scheduleGames, ymd, stats) {
  const boardGames = [];

  for (const scheduleGame of scheduleGames) {
    const gamePk = String(scheduleGame?.gamePk || scheduleGame?.id || "");
    if (!gamePk) continue;

    const gameRef = db.collection("mlb_live_games").doc(gamePk);

    try {
      const existingSnap = await gameRef.get();
      const existing = existingSnap.exists ? existingSnap.data() || {} : null;
      const scheduleDoc = buildMlbLiveDocFromScheduleGame(scheduleGame, ymd);

      if (!existing) {
        await gameRef.set(
          {
            ...scheduleDoc,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        stats.written += 1;
        boardGames.push(compactMlbBoardEntry(scheduleDoc, gamePk));
        continue;
      }

      boardGames.push(
        compactMlbBoardEntry(
          {
            ...scheduleDoc,
            ...existing,
            ymd,
            gamePk,
          },
          gamePk
        )
      );
    } catch (err) {
      logger.error("[mlbLive] light seed game failed", {
        gamePk,
        error: err?.message || String(err),
      });
    }
  }

  return boardGames;
}

async function runUpdateMlbLiveGames(forYmd, options = {}) {
  const { forceRun = false, source = "cron" } = options;
  const ymd =
    typeof forYmd === "string" && forYmd.length >= 10 ? forYmd.slice(0, 10) : todayAppYmd();

  const nowMs = Date.now();
  const league = LIVE_LEAGUES.MLB;

  const stats = {
    ymd,
    source,
    games: 0,
    feedPolled: 0,
    feedSkipped: 0,
    unchanged: 0,
    written: 0,
    feedFetched: 0,
    scoringPlays: 0,
    bvpInvalidated: 0,
    mode: null,
    skippedHeavy: false,
    skippedModeCheck: false,
  };

  const control = await readLiveControl(league, ymd);
  if (!shouldRefreshModeCheck({ control, nowMs, forceRun })) {
    stats.skippedModeCheck = true;
    stats.mode = control?.mode || null;
    logLiveControlDecision(league, ymd, { action: "skip_mode_check", mode: stats.mode, source });
    return stats;
  }

  const scheduleGames = await loadScheduleGamesForYmd(ymd);
  stats.games = scheduleGames.length;

  const mode = computeMlbDayMode(scheduleGames, nowMs);
  stats.mode = mode;

  await writeLiveControl(league, ymd, {
    mode,
    lastModeCheckAt: nowMs,
    gamesOnSchedule: scheduleGames.length,
    source,
  });

  logger.info("[mlbLive] tick", { ymd, games: scheduleGames.length, mode, source, forceRun });

  if (!scheduleGames.length) {
    logger.warn("[mlbLive] no schedule games — check mlb_schedule_daily", { ymd });
  }

  if (!shouldRunHeavyIngest({ mode, lastHeavyRunAt: control?.lastHeavyRunAt, nowMs, forceRun })) {
    stats.skippedHeavy = true;
    logLiveControlDecision(league, ymd, {
      action: "skip_heavy",
      mode,
      source,
      games: scheduleGames.length,
    });

    if (scheduleGames.length) {
      const boardGames = await seedMlbLiveBoardFromScheduleOnly(scheduleGames, ymd, stats);
      try {
        await upsertLiveBoard(league, ymd, boardGames);
        stats.boardGameCount = boardGames.length;
      } catch (err) {
        logger.warn("[mlbLive] light board upsert failed", {
          ymd,
          error: err?.message || String(err),
        });
      }

      await writeLiveControl(league, ymd, {
        mode,
        lastBoardSeedAt: nowMs,
        boardGameCount: boardGames.length,
      });
    }

    return stats;
  }

  const boardGames = [];

  for (const scheduleGame of scheduleGames) {
    const gamePk = String(scheduleGame?.gamePk || scheduleGame?.id || "");
    if (!gamePk) continue;

    const gameRef = db.collection("mlb_live_games").doc(gamePk);

    try {
      const existingSnap = await gameRef.get();
      const existing = existingSnap.exists ? existingSnap.data() || {} : null;

      let doc = buildMlbLiveDocFromScheduleGame(scheduleGame, ymd);
      let liveFeed = null;

      const pollLiveFeed = shouldPollMlbGame(scheduleGame, existing, nowMs);

      if (pollLiveFeed && needsMlbLiveFeed(scheduleGame, doc)) {
        stats.feedPolled += 1;
        try {
          liveFeed = await fetchMlbLiveFeed(gamePk);
          stats.feedFetched += 1;
          doc = mergeMlbLiveFeedIntoDoc(doc, liveFeed);

          if (doc.isLive || doc.isFinal) {
            stats.scoringPlays += await upsertScoringPlays(gameRef, liveFeed, gamePk);
          }
        } catch (err) {
          logger.warn("[mlbLive] live feed failed", {
            gamePk,
            error: err?.message || String(err),
          });
        }
      } else if (needsMlbLiveFeed(scheduleGame, doc)) {
        stats.feedSkipped += 1;
      }

      const justFinalized = doc.isFinal && !existing?.finalizedAt;

      if (justFinalized) {
        doc.finalizedAt = nowMs;
        try {
          const inv = await invalidateMlbBvpCacheForFinalGame(scheduleGame, {
            gamePk,
            liveFeed,
          });
          if (!inv.skipped && inv.deleted > 0) {
            stats.bvpInvalidated += inv.deleted;
          }
        } catch (err) {
          logger.warn("[mlbLive] bvp cache invalidation failed", {
            gamePk,
            error: err?.message || String(err),
          });
        }
      } else if (existing?.finalizedAt) {
        doc.finalizedAt = existing.finalizedAt;
      }

      if (existing && shallowFieldsEqual(existing, doc, MLB_LIVE_DOC_COMPARE_KEYS)) {
        stats.unchanged += 1;
      } else {
        await gameRef.set(
          {
            ...doc,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        stats.written += 1;
      }

      if (shouldVoidChallengesForStatus(scheduleGame?.status || doc, existing)) {
        try {
          await handleMlbGamePostponed({
            db,
            gamePk,
            ymd,
            source: "mlbLive",
          });
        } catch (err) {
          logger.warn("[mlbLive] postponed handler failed", {
            gamePk,
            error: err?.message || String(err),
          });
        }
      }

      boardGames.push(compactMlbBoardEntry(doc, gamePk));
    } catch (err) {
      logger.error("[mlbLive] game failed", {
        gamePk,
        error: err?.message || String(err),
      });
    }
  }

  try {
    await upsertLiveBoard(league, ymd, boardGames);
  } catch (err) {
    logger.warn("[mlbLive] live board upsert failed", {
      ymd,
      error: err?.message || String(err),
    });
  }

  await writeLiveControl(league, ymd, {
    mode,
    lastHeavyRunAt: nowMs,
    lastHeavyStats: stats,
    boardGameCount: boardGames.length,
  });

  logger.info("[mlbLive] done", stats);
  return stats;
}

export const updateMlbLiveGamesNow = onCall({ region: "us-central1" }, async (request) => {
  const ymd =
    typeof request?.data?.date === "string" && request.data.date.length >= 10
      ? request.data.date.slice(0, 10)
      : null;

  const stats = await runUpdateMlbLiveGames(ymd, { forceRun: true, source: "callable" });
  return { ok: true, ymd: ymd || todayAppYmd(), stats };
});

export const updateMlbLiveGamesCron = onSchedule(
  {
    schedule: LIVE_CRON_SCHEDULE,
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    try {
      if (!isWithinLiveCronSchedule()) {
        logger.info("[mlbLive] cron skipped — outside active window");
        return;
      }

      const todayYmd = todayAppYmd();
      const hour = torontoCurrentHour();

      if (hour < LIVE_CRON_YESTERDAY_UNTIL_HOUR) {
        const yesterdayYmd = addDaysToYmd(todayYmd, -1);
        await runUpdateMlbLiveGames(yesterdayYmd, { source: "cron" });
      }

      await runUpdateMlbLiveGames(todayYmd, { source: "cron" });
    } catch (err) {
      logger.error("[mlbLive] cron failed", {
        error: err?.message || String(err),
        stack: err?.stack,
      });
    }
  }
);

export { runUpdateMlbLiveGames };
