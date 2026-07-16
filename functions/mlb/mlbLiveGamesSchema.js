/**
 * Schéma `mlb_live_games/{gamePk}` — miroir conceptuel de `nhl_live_games`.
 *
 * Doc principal:
 * - gamePk, ymd, date (YYYY-MM-DD legacy)
 * - awayAbbr, homeAbbr
 * - awayScore, homeScore
 * - isLive, isFinal, isPostponed
 * - currentInning, currentInningOrdinal, inningState, inningHalf
 * - abstractGameState, detailedState
 * - startTimeUTC, venue, updatedAt
 * - finalizedAt (timestamp ms quand isFinal détecté)
 * - balls, strikes, outs, onFirst, onSecond, onThird, runnersOnBase (situation live)
 *
 * Sous-collection `scoring_plays/{playId}`:
 * - playId, gamePk, inning, halfInning, battingTeamAbbr, eventType, description
 * - rbi, awayScore, homeScore, updatedAt
 */

import { isMlbGamePostponed, isMlbGameDelayed } from "./mlbGameStatus.js";

export const MLB_LIVE_DOC_COMPARE_KEYS = [
  "awayAbbr",
  "homeAbbr",
  "awayScore",
  "homeScore",
  "isLive",
  "isFinal",
  "isPostponed",
  "currentInning",
  "currentInningOrdinal",
  "inningState",
  "inningHalf",
  "abstractGameState",
  "detailedState",
  "balls",
  "strikes",
  "outs",
  "onFirst",
  "onSecond",
  "onThird",
  "runnersOnBase",
];

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function teamAbbrFromNode(node) {
  return safeUpper(
    node?.abbreviation || node?.team?.abbreviation || node?.team?.teamCode || node?.team?.fileCode
  );
}

export function buildMlbLiveDocFromScheduleGame(game = {}, ymd) {
  const gamePk = String(game?.gamePk || "");
  const away = game?.awayTeam || {};
  const home = game?.homeTeam || {};
  const status = game?.status || {};
  const abstract = String(status?.abstractGameState || "");
  const abstractLower = abstract.toLowerCase();
  const postponed = isMlbGamePostponed(status);

  return {
    gamePk,
    ymd,
    date: ymd,
    awayAbbr: safeUpper(away?.abbreviation),
    homeAbbr: safeUpper(home?.abbreviation),
    awayScore: away?.score != null ? Number(away.score) : null,
    homeScore: home?.score != null ? Number(home.score) : null,
    isLive: abstractLower === "live",
    isFinal: abstractLower === "final" && !postponed,
    isPostponed: postponed,
    currentInning: game?.currentInning != null ? Number(game.currentInning) : null,
    currentInningOrdinal: String(game?.currentInningOrdinal || ""),
    inningState: String(game?.inningState || ""),
    inningHalf: "",
    abstractGameState: abstract,
    detailedState: String(status?.detailedState || ""),
    startTimeUTC: game?.startTimeUTC || game?.gameDateRaw || null,
    venue: game?.venue?.name || null,
  };
}

export function mergeMlbLiveFeedIntoDoc(baseDoc = {}, liveFeed = {}) {
  const linescore = liveFeed?.liveData?.linescore || {};
  const status = liveFeed?.gameData?.status || {};
  const awayNode = liveFeed?.gameData?.teams?.away || {};
  const homeNode = liveFeed?.gameData?.teams?.home || {};
  const abstract = String(status?.abstractGameState || baseDoc.abstractGameState || "");
  const abstractLower = abstract.toLowerCase();
  const postponed = isMlbGamePostponed(status);

  const awayScoreRaw = linescore?.teams?.away?.runs ?? awayNode?.score;
  const homeScoreRaw = linescore?.teams?.home?.runs ?? homeNode?.score;

  const isFinal =
    !postponed &&
    (abstractLower === "final" ||
      String(status?.detailedState || "").toLowerCase().includes("final") ||
      String(linescore?.currentInningState || "").toLowerCase() === "final");

  const isLive = abstractLower === "live" && !postponed;
  const situation = isLive ? extractLiveSituationFromFeed(liveFeed) : emptyLiveSituation();

  return {
    ...baseDoc,
    awayAbbr: baseDoc.awayAbbr || teamAbbrFromNode(awayNode),
    homeAbbr: baseDoc.homeAbbr || teamAbbrFromNode(homeNode),
    awayScore: awayScoreRaw != null ? Number(awayScoreRaw) : baseDoc.awayScore,
    homeScore: homeScoreRaw != null ? Number(homeScoreRaw) : baseDoc.homeScore,
    isLive,
    isFinal,
    isPostponed: postponed,
    currentInning:
      linescore?.currentInning != null ? Number(linescore.currentInning) : baseDoc.currentInning,
    currentInningOrdinal: String(linescore?.currentInningOrdinal || baseDoc.currentInningOrdinal || ""),
    inningState: String(linescore?.inningState || baseDoc.inningState || ""),
    inningHalf: String(linescore?.inningHalf || ""),
    abstractGameState: abstract,
    detailedState: String(status?.detailedState || ""),
    ...situation,
  };
}

export function extractMlbOfficialResultFromLiveDoc(doc = {}, slot = {}) {
  const awayScore = Number(doc?.awayScore ?? 0);
  const homeScore = Number(doc?.homeScore ?? 0);
  const awayAbbr = safeUpper(slot?.awayAbbr || doc?.awayAbbr);
  const homeAbbr = safeUpper(slot?.homeAbbr || doc?.homeAbbr);

  let winnerAbbr = null;
  if (awayScore > homeScore) winnerAbbr = awayAbbr;
  else if (homeScore > awayScore) winnerAbbr = homeAbbr;

  return {
    winnerAbbr,
    awayScore,
    homeScore,
    outcome: "FINAL",
  };
}

export function isMlbLiveDocFinal(doc = {}) {
  if (doc?.isPostponed) return false;
  if (doc?.isFinal === true) return true;
  return String(doc?.abstractGameState || "").toLowerCase() === "final";
}

/**
 * Coût API: ne poller le feed live que pour les matchs actifs, proches du début, ou fin récents.
 * Les docs `mlb_live_games` sont toujours créés depuis le calendrier (affichage MLB Live).
 */
export function shouldPollMlbGame(game = {}, existingDoc = null, nowMs = Date.now()) {
  const status = game?.status || {};
  const abstract = String(status?.abstractGameState || "").toLowerCase();
  const postponed = isMlbGamePostponed(status);
  const delayed = isMlbGameDelayed(status);

  if (postponed) return true;

  if (abstract === "live" || delayed) return true;

  if (abstract === "final") {
    const finalizedAt = Number(existingDoc?.finalizedAt || 0);
    if (!finalizedAt) return true;
    return nowMs - finalizedAt <= 4 * 60 * 60 * 1000;
  }

  const startMs = parseGameStartMs(game);
  if (startMs && nowMs >= startMs - 90 * 60 * 1000 && nowMs <= startMs + 30 * 60 * 1000) {
    return true;
  }

  return false;
}

function parseGameStartMs(game) {
  const raw = game?.startTimeUTC || game?.gameDateRaw;
  if (!raw) return null;
  const d = raw?.toDate?.() ? raw.toDate() : new Date(raw);
  return Number.isFinite(d?.getTime?.()) ? d.getTime() : null;
}

export function needsMlbLiveFeed(game = {}, doc = {}) {
  const abstract = String(game?.status?.abstractGameState || doc?.abstractGameState || "").toLowerCase();
  return abstract === "live" || abstract === "final";
}

function clampCount(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(max, Math.floor(n)));
}

/** Situation au bâton depuis le feed live (compte + buts occupés). */
export function extractLiveSituationFromFeed(liveFeed = {}) {
  const linescore = liveFeed?.liveData?.linescore || {};
  const balls = clampCount(linescore?.balls, 3);
  const strikes = clampCount(linescore?.strikes, 2);
  const outs = clampCount(linescore?.outs, 2);

  const bases = { onFirst: false, onSecond: false, onThird: false };

  const runners = liveFeed?.liveData?.plays?.currentPlay?.runners;
  if (Array.isArray(runners)) {
    for (const runner of runners) {
      if (runner?.movement?.isOut) continue;
      const end = String(runner?.movement?.end || "").toUpperCase();
      if (end === "1B") bases.onFirst = true;
      else if (end === "2B") bases.onSecond = true;
      else if (end === "3B") bases.onThird = true;
    }
  }

  const offense = linescore?.offense || {};
  if (offense?.first) bases.onFirst = true;
  if (offense?.second) bases.onSecond = true;
  if (offense?.third) bases.onThird = true;

  const runnersOnBase = [bases.onFirst, bases.onSecond, bases.onThird].filter(Boolean).length;

  return {
    balls,
    strikes,
    outs,
    onFirst: bases.onFirst,
    onSecond: bases.onSecond,
    onThird: bases.onThird,
    runnersOnBase,
  };
}

function emptyLiveSituation() {
  return {
    balls: null,
    strikes: null,
    outs: null,
    onFirst: false,
    onSecond: false,
    onThird: false,
    runnersOnBase: 0,
  };
}

/** Extrait les actions marquantes (runs) pour `scoring_plays`. */
export function extractScoringPlaysFromFeed(liveFeed = {}, gamePk = "") {
  const plays = liveFeed?.liveData?.plays?.allPlays;
  if (!Array.isArray(plays)) return [];

  const out = [];

  for (const play of plays) {
    const about = play?.about || {};
    const result = play?.result || {};
    const rbi = Number(result?.rbi ?? 0);
    const eventType = String(result?.eventType || result?.event || "").toLowerCase();
    const isScoring =
      rbi > 0 ||
      eventType.includes("home_run") ||
      eventType.includes("single") ||
      eventType.includes("double") ||
      eventType.includes("triple") ||
      eventType.includes("sac_fly") ||
      eventType.includes("field_error");

    if (!isScoring) continue;

    const playId = String(play?.about?.atBatIndex ?? play?.playEvents?.[0]?.playId ?? `${about.inning}-${about.halfInning}-${out.length}`);
    if (!playId) continue;

    const half = String(about.halfInning || "").toLowerCase();
    const battingTeamAbbr =
      half === "top"
        ? String(liveFeed?.gameData?.teams?.away?.abbreviation || "").trim()
        : half === "bottom"
          ? String(liveFeed?.gameData?.teams?.home?.abbreviation || "").trim()
          : "";

    out.push({
      playId,
      gamePk: String(gamePk),
      inning: about.inning ?? null,
      halfInning: String(about.halfInning || ""),
      battingTeamAbbr: battingTeamAbbr || null,
      eventType: String(result?.eventType || result?.event || ""),
      description: String(result?.description || play?.result?.description || ""),
      rbi: Number.isFinite(rbi) ? rbi : 0,
      awayScore: result?.awayScore ?? null,
      homeScore: result?.homeScore ?? null,
    });
  }

  return out;
}
