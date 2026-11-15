import { FieldValue } from "firebase-admin/firestore";
import { db, logger, apiWebPbp } from "../utils.js";
import { addDaysToYmd, appYmd } from "../ProphetikDate.js";
import { getNhlCurrentSeasonId } from "../players/seasonHelpers.js";
import {
  computeFirstValidGoalFromGoals,
  isValidGoal,
  timeInPeriodToSeconds,
  toInt,
} from "../firstGoalChallenge/nhlFirstGoalGoalUtils.js";

export const PROCESSED_COL = "nhl_first_goal_season_processed";
export const FIRST_GOAL_GAMES_COL = "nhl_first_goal_games";

function ymdCompact(ymdDashed) {
  return String(ymdDashed || "").slice(0, 10).replace(/-/g, "");
}

function extractPlays(pbp) {
  if (!pbp) return [];
  if (Array.isArray(pbp.plays)) return pbp.plays;
  if (Array.isArray(pbp.allPlays)) return pbp.allPlays;
  if (Array.isArray(pbp?.playsByPeriod)) {
    const out = [];
    for (const blk of pbp.playsByPeriod) {
      if (Array.isArray(blk?.plays)) out.push(...blk.plays);
    }
    return out;
  }
  return [];
}

function isGoalPlay(play) {
  const typeKey = String(play?.typeDescKey || play?.type || play?.eventType || "").toLowerCase();
  const typeCode = Number(play?.typeCode || play?.eventTypeId || 0);
  return typeKey === "goal" || typeCode === 505;
}

function normTeamAbbr(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw.toUpperCase();
  return String(raw.abbrev || raw.default || "").toUpperCase() || null;
}

export function isNhlScheduleGameFinal(gameState) {
  const s = String(gameState || "").toUpperCase();
  return s === "OFF" || s === "FINAL" || s.includes("FINAL");
}

export function resolveSeasonIdForGameYmd(gameYmdDashed) {
  const ymd = String(gameYmdDashed || "").slice(0, 10);
  if (!ymd) return getNhlCurrentSeasonId();
  const d = new Date(`${ymd}T12:00:00Z`);
  return getNhlCurrentSeasonId(d);
}

/** Début régulier par défaut : octobre de la 1re année du id NHL (20262027 → 2026-10-01). */
export function defaultSeasonStartYmd(seasonId) {
  const s = String(seasonId || getNhlCurrentSeasonId());
  const startYear = /^\d{8}$/.test(s) ? s.slice(0, 4) : String(new Date().getFullYear());
  return `${startYear}-10-01`;
}

export async function resolveNhlSeasonStartYmd(gameDb, seasonId) {
  const sid = String(seasonId || getNhlCurrentSeasonId()).trim();
  const fallback = defaultSeasonStartYmd(sid);

  try {
    const snap = await gameDb.doc("app_config/currentSeason").get();
    const c = snap.exists ? snap.data() || {} : {};
    if (String(c?.sport || "").toUpperCase() !== "NHL") return fallback;

    const rs = String(c.regularSeasonStartYmd || c.regularSeasonStartDate || c.fromYmd || "").slice(
      0,
      10
    );
    if (!rs) return fallback;

    const cfgSeason = String(c?.seasonId || "");
    const seasonStartYear = sid.slice(0, 4);
    const rsYear = rs.slice(0, 4);

    if (cfgSeason === sid || rsYear === seasonStartYear) {
      return rs;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function sortGoalRows(rows) {
  return [...rows].sort((a, b) => {
    const pa = toInt(a.period, 99);
    const pb = toInt(b.period, 99);
    if (pa !== pb) return pa - pb;

    const sa = timeInPeriodToSeconds(a.timeInPeriod) ?? 999999;
    const sb = timeInPeriodToSeconds(b.timeInPeriod) ?? 999999;
    if (sa !== sb) return sa - sb;

    return String(a.goalId || "").localeCompare(String(b.goalId || ""));
  });
}

export function computeFirstValidGoalFromPbpPlays(plays = []) {
  const rows = [];

  for (const play of plays) {
    if (!isGoalPlay(play)) continue;

    const periodType = String(play?.periodDescriptor?.periodType || "").toUpperCase();
    if (periodType === "SO") continue;

    const det = play?.details || {};
    if (det.disallowed === true || det.disallowedGoal === true || det.voided === true) continue;

    const scoringPlayerId = det.scoringPlayerId || det.scorerPlayerId || det.playerId || null;
    if (!scoringPlayerId) continue;

    const teamAbbr = normTeamAbbr(
      det.teamAbbrev || det.eventOwnerTeamAbbrev || det.teamAbbr
    );

    rows.push({
      goalId: String(play?.eventId || ""),
      scoringPlayerId: String(scoringPlayerId),
      scoringPlayerName:
        det.scoringPlayerName?.default ||
        det.scoringPlayerName ||
        det.scorerName?.default ||
        det.scorerName ||
        null,
      teamAbbr,
      period: play?.periodDescriptor?.number ?? null,
      timeInPeriod:
        det.timeInPeriod || play.timeInPeriod || det.timeRemaining || play.timeRemaining || null,
      periodType,
    });
  }

  const valid = rows.filter(
    (g) => g?.scoringPlayerId && isValidGoal({ ...g, voided: false, disallowed: false })
  );
  if (!valid.length) return null;

  return sortGoalRows(valid)[0];
}

export async function resolveFirstGoalForFinishedGame(gameDb, gameId) {
  const gid = String(gameId || "").trim();
  if (!gid) return null;

  const fgSnap = await gameDb.doc(`${FIRST_GOAL_GAMES_COL}/${gid}`).get();
  if (fgSnap.exists) {
    const data = fgSnap.data() || {};
    const st = String(data.status || "").toLowerCase();
    if (st === "confirmed" && data.result?.playerId) {
      return {
        source: "nhl_first_goal_games",
        scoringPlayerId: String(data.result.playerId),
        scoringPlayerName: data.result.playerName || null,
        teamAbbr: data.result.teamAbbr || null,
        goalId: data.result.goalId ? String(data.result.goalId) : null,
      };
    }
    if (st === "no_winner") {
      return { source: "nhl_first_goal_games", noFirstGoal: true };
    }
  }

  const fromGoals = await computeFirstValidGoalFromGoals(gameDb, gid);
  if (fromGoals?.scoringPlayerId) {
    return {
      source: "nhl_live_goals",
      scoringPlayerId: String(fromGoals.scoringPlayerId),
      scoringPlayerName: fromGoals.scoringPlayerName || null,
      teamAbbr: fromGoals.teamAbbr || null,
      goalId: fromGoals.goalId ? String(fromGoals.goalId) : null,
    };
  }

  try {
    const pbp = await apiWebPbp(gid);
    const first = computeFirstValidGoalFromPbpPlays(extractPlays(pbp));
    if (first?.scoringPlayerId) {
      return {
        source: "pbp",
        scoringPlayerId: String(first.scoringPlayerId),
        scoringPlayerName: first.scoringPlayerName || null,
        teamAbbr: first.teamAbbr || null,
        goalId: first.goalId || null,
      };
    }
  } catch (e) {
    logger.warn("[nhlFirstGoalSeasonStats] pbp failed", {
      gameId: gid,
      error: String(e?.message || e),
    });
  }

  return { source: "none", noFirstGoal: true };
}

async function adjustPlayerFirstGoals(gameDb, { seasonId, playerId, delta }) {
  const sid = String(seasonId || "").trim();
  const pid = String(playerId || "").trim();
  const d = Number(delta);
  if (!sid || !pid || !Number.isFinite(d) || d === 0) return;

  const ref = gameDb.doc(`nhl_players/${pid}`);
  try {
    await ref.update({
      [`firstGoalsBySeason.${sid}`]: FieldValue.increment(d),
      firstGoalsBySeasonUpdatedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    const code = String(e?.code ?? "");
    if (code !== "5" && !/NOT_FOUND/i.test(String(e?.message || ""))) {
      throw e;
    }
    await ref.set(
      {
        firstGoalsBySeason: { [sid]: d },
        firstGoalsBySeasonUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function processFinishedGameForSeasonStats(
  gameDb,
  { gameId, gameYmdDashed, seasonId, dryRun = false } = {}
) {
  const gid = String(gameId || "").trim();
  const ymd = String(gameYmdDashed || "").slice(0, 10);
  const sid = String(seasonId || resolveSeasonIdForGameYmd(ymd));

  if (!gid || !ymd) {
    return { gameId: gid, action: "skip", reason: "missing_ids" };
  }

  const processedRef = gameDb.doc(`${PROCESSED_COL}/${gid}`);
  const processedSnap = await processedRef.get();
  const prev = processedSnap.exists ? processedSnap.data() || {} : null;

  const resolved = await resolveFirstGoalForFinishedGame(gameDb, gid);
  const nextPlayerId =
    resolved?.noFirstGoal || !resolved?.scoringPlayerId
      ? null
      : String(resolved.scoringPlayerId);

  const prevPlayerId = prev?.scoringPlayerId ? String(prev.scoringPlayerId) : null;
  const statsAlreadyApplied = prev?.playerStatsApplied === true;

  if (
    prev?.seasonId === sid &&
    prev?.scoringPlayerId === nextPlayerId &&
    prev?.status !== "pending" &&
    statsAlreadyApplied
  ) {
    return { gameId: gid, action: "unchanged", seasonId: sid, scoringPlayerId: nextPlayerId };
  }

  if (dryRun) {
    return {
      gameId: gid,
      action: "dry_run",
      seasonId: sid,
      prevPlayerId,
      nextPlayerId,
      source: resolved?.source || null,
    };
  }

  if (prevPlayerId && prevPlayerId !== nextPlayerId) {
    await adjustPlayerFirstGoals(gameDb, { seasonId: sid, playerId: prevPlayerId, delta: -1 });
  }

  const needsApplyIncrement =
    nextPlayerId &&
    (prevPlayerId !== nextPlayerId || !statsAlreadyApplied);

  if (needsApplyIncrement) {
    await adjustPlayerFirstGoals(gameDb, { seasonId: sid, playerId: nextPlayerId, delta: 1 });
  }

  await processedRef.set(
    {
      gameId: gid,
      gameYmd: ymd,
      seasonId: sid,
      scoringPlayerId: nextPlayerId,
      status: nextPlayerId ? "counted" : "no_first_goal",
      source: resolved?.source || null,
      teamAbbr: resolved?.teamAbbr || null,
      playerStatsApplied: nextPlayerId
        ? needsApplyIncrement || statsAlreadyApplied
        : true,
      processedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    gameId: gid,
    action: prev ? "updated" : "counted",
    seasonId: sid,
    scoringPlayerId: nextPlayerId,
    source: resolved?.source || null,
  };
}

export async function loadFinalScheduleGamesForYmd(gameDb, ymdDashed) {
  const compact = ymdCompact(ymdDashed);
  if (!compact) return [];

  const snap = await gameDb.collection(`nhl_schedule_daily/${compact}/games`).get();
  const out = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const gameId = String(data.gameId || doc.id || "").trim();
    if (!gameId) continue;
    if (!isNhlScheduleGameFinal(data.gameState)) continue;

    out.push({
      gameId,
      gameYmdDashed: String(ymdDashed).slice(0, 10),
      gameState: data.gameState || null,
    });
  }

  return out;
}

export function iterateYmdInclusive(fromYmdDashed, toYmdDashed) {
  const from = String(fromYmdDashed || "").slice(0, 10);
  const to = String(toYmdDashed || "").slice(0, 10);
  if (!from || !to) return [];

  const days = [];
  let cur = from;
  let guard = 0;

  while (cur <= to && guard < 400) {
    days.push(cur);
    if (cur === to) break;
    cur = addDaysToYmd(cur, 1);
    guard += 1;
  }

  return days;
}

export async function syncNhlFirstGoalSeasonStatsForRange(
  gameDb,
  {
    fromYmdDashed,
    toYmdDashed,
    maxGames = 40,
    dryRun = false,
  } = {}
) {
  const days = iterateYmdInclusive(fromYmdDashed, toYmdDashed);
  const stats = {
    fromYmd: fromYmdDashed,
    toYmd: toYmdDashed,
    daysScanned: days.length,
    gamesSeen: 0,
    processed: 0,
    unchanged: 0,
    counted: 0,
    noFirstGoal: 0,
    updated: 0,
    errors: 0,
    stoppedAtMax: false,
    samples: [],
  };

  let budget = Math.max(1, Number(maxGames) || 40);

  for (const ymd of days) {
    if (budget <= 0) {
      stats.stoppedAtMax = true;
      break;
    }

    let games = [];
    try {
      games = await loadFinalScheduleGamesForYmd(gameDb, ymd);
    } catch (e) {
      stats.errors += 1;
      logger.warn("[nhlFirstGoalSeasonStats] schedule load failed", {
        ymd,
        error: String(e?.message || e),
      });
      continue;
    }

    for (const g of games) {
      if (budget <= 0) {
        stats.stoppedAtMax = true;
        break;
      }

      stats.gamesSeen += 1;
      budget -= 1;

      try {
        const seasonId = resolveSeasonIdForGameYmd(g.gameYmdDashed);
        const result = await processFinishedGameForSeasonStats(gameDb, {
          gameId: g.gameId,
          gameYmdDashed: g.gameYmdDashed,
          seasonId,
          dryRun,
        });

        stats.processed += 1;
        if (result.action === "unchanged") {
          stats.unchanged += 1;
          budget += 1;
        }
        if (result.action === "counted") stats.counted += 1;
        if (result.action === "updated") stats.updated += 1;
        if (!result.scoringPlayerId && result.action !== "unchanged") stats.noFirstGoal += 1;

        if (stats.samples.length < 8 && result.action !== "unchanged") {
          stats.samples.push(result);
        }
      } catch (e) {
        stats.errors += 1;
        logger.warn("[nhlFirstGoalSeasonStats] game failed", {
          gameId: g.gameId,
          ymd: g.gameYmdDashed,
          error: String(e?.message || e),
        });
      }
    }
  }

  return stats;
}

export async function runDailyNhlFirstGoalSeasonStatsSync(gameDb, now = new Date()) {
  const today = appYmd(now);
  const fromYmd = addDaysToYmd(today, -3);
  return syncNhlFirstGoalSeasonStatsForRange(gameDb, {
    fromYmdDashed: fromYmd,
    toYmdDashed: today,
    maxGames: 60,
    dryRun: false,
  });
}

/** Recalcule firstGoalsBySeason depuis nhl_first_goal_season_processed (rattrapage). */
export async function rebuildNhlFirstGoalSeasonCountsFromProcessed(gameDb, seasonId) {
  const sid = String(seasonId || getNhlCurrentSeasonId()).trim();
  const snap = await gameDb.collection(PROCESSED_COL).where("seasonId", "==", sid).get();

  const counts = {};
  let marked = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (String(data.status || "") !== "counted") continue;
    const pid = String(data.scoringPlayerId || "").trim();
    if (!pid) continue;
    counts[pid] = (counts[pid] || 0) + 1;
    marked += 1;
  }

  let batch = gameDb.batch();
  let ops = 0;
  let playersWritten = 0;

  for (const [playerId, total] of Object.entries(counts)) {
    batch.set(
      gameDb.doc(`nhl_players/${playerId}`),
      {
        firstGoalsBySeason: { [sid]: total },
        firstGoalsBySeasonUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    ops += 1;
    playersWritten += 1;

    if (ops >= 400) {
      await batch.commit();
      batch = gameDb.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  const flagBatch = gameDb.batch();
  let flagOps = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (String(data.status || "") !== "counted") continue;
    flagBatch.set(
      doc.ref,
      { playerStatsApplied: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    flagOps += 1;
    if (flagOps >= 400) {
      await flagBatch.commit();
      flagBatch = gameDb.batch();
      flagOps = 0;
    }
  }
  if (flagOps > 0) await flagBatch.commit();

  return {
    ok: true,
    seasonId: sid,
    processedDocs: snap.size,
    countedGames: marked,
    uniqueScorers: Object.keys(counts).length,
    playersWritten,
  };
}

export async function runBackfillNhlFirstGoalSeasonStats(gameDb, options = {}) {
  const seasonId = String(options.seasonId || getNhlCurrentSeasonId()).trim();
  const fromYmd =
    String(options.fromYmdDashed || "").slice(0, 10) ||
    (await resolveNhlSeasonStartYmd(gameDb, seasonId));
  const toYmd = String(options.toYmdDashed || appYmd()).slice(0, 10);
  const maxGames = Number(options.maxGames) > 0 ? Number(options.maxGames) : 80;

  const stats = await syncNhlFirstGoalSeasonStatsForRange(gameDb, {
    fromYmdDashed: fromYmd,
    toYmdDashed: toYmd,
    maxGames,
    dryRun: options.dryRun === true,
  });

  return { seasonId, fromYmd, toYmd, ...stats };
}
