import { buildEmptyMlbPitcher } from "../mlb/mlbProbablePitchers.js";

const MLB_LIVE_FEED_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;

export const TP_DEFAULT_SCORING = {
  winnerBasePoints: 3,
  exactScoreBonusPoints: 3,
  riskScoringEnabled: false,
  riskPoints: {
    logical: 3,
    mixed: 5,
    risky: 10,
  },
};

export function pickString(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

export function normalizeLeague(v) {
  const league = safeUpper(v || "NHL");
  if (league === "NHL" || league === "MLB") return league;
  return "NHL";
}

export function ymdFromDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function getDateValue(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildTeamPredictionChallengeId({ league, groupId, gameId }) {
  return `tp_${normalizeLeague(league).toLowerCase()}_${groupId}_${gameId}`;
}

export function buildLegacyNhlChallengeId({ groupId, gameId }) {
  return `tp_${groupId}_${gameId}`;
}

export async function findExistingTeamPredictionChallenge(db, { league, groupId, gameId }) {
  const normalizedLeague = normalizeLeague(league);
  const primaryId = buildTeamPredictionChallengeId({
    league: normalizedLeague,
    groupId,
    gameId,
  });

  const primaryRef = db.doc(`team_prediction_challenges/${primaryId}`);
  const primarySnap = await primaryRef.get();

  if (primarySnap.exists) {
    return { challengeRef: primaryRef, challengeSnap: primarySnap, challengeId: primaryId };
  }

  if (normalizedLeague === "NHL") {
    const legacyId = buildLegacyNhlChallengeId({ groupId, gameId });
    const legacyRef = db.doc(`team_prediction_challenges/${legacyId}`);
    const legacySnap = await legacyRef.get();

    if (legacySnap.exists) {
      return { challengeRef: legacyRef, challengeSnap: legacySnap, challengeId: legacyId };
    }
  }

  return { challengeRef: primaryRef, challengeSnap: primarySnap, challengeId: primaryId };
}

export function isActiveChallengeStatus(status) {
  return ["open", "locked", "decided"].includes(String(status || "").toLowerCase());
}

function isNhlGameTerminated(gameState) {
  return safeUpper(gameState) === "OFF";
}

function isMlbGameTerminated(status = {}) {
  const abstract = safeUpper(status?.abstractGameState);
  const coded = safeUpper(status?.codedGameState || status?.statusCode);
  return abstract === "FINAL" || coded === "F";
}

export async function loadNhlScheduleGame(db, { gameId, todayYmd }) {
  const gameRef = db.doc(`nhl_schedule_daily/${todayYmd}/games/${gameId}`);
  const gameSnap = await gameRef.get();

  if (!gameSnap.exists) {
    return { ok: false, reason: "not-found", path: gameRef.path };
  }

  const game = gameSnap.data() || {};
  const awayAbbr = safeUpper(game.away?.abbr);
  const homeAbbr = safeUpper(game.home?.abbr);
  const startDate = getDateValue(game.startTimeUTC);
  const gameState = safeUpper(game.gameState);

  if (!awayAbbr || !homeAbbr || !startDate) {
    return { ok: false, reason: "incomplete-game-data" };
  }

  if (isNhlGameTerminated(gameState)) {
    return { ok: false, reason: "game-finished" };
  }

  return {
    ok: true,
    awayAbbr,
    homeAbbr,
    startDate,
    gameState,
    gameYmd: todayYmd,
  };
}

export async function loadMlbScheduleGame(db, { gameId, todayYmd }) {
  const gameRef = db.doc(`mlb_schedule_daily/${todayYmd}/games/${gameId}`);
  const gameSnap = await gameRef.get();

  if (!gameSnap.exists) {
    return { ok: false, reason: "not-found", path: gameRef.path };
  }

  const game = gameSnap.data() || {};
  const awayAbbr = safeUpper(game.awayTeam?.abbreviation);
  const homeAbbr = safeUpper(game.homeTeam?.abbreviation);
  const startDate = getDateValue(game.startTimeUTC) || getDateValue(game.gameDateRaw);
  const gameState = safeUpper(game.status?.abstractGameState);

  if (!awayAbbr || !homeAbbr || !startDate) {
    return { ok: false, reason: "incomplete-game-data" };
  }

  if (isMlbGameTerminated(game.status || {})) {
    return { ok: false, reason: "game-finished" };
  }

  return {
    ok: true,
    awayAbbr,
    homeAbbr,
    startDate,
    gameState,
    gameYmd: todayYmd,
    homeProbablePitcher: game.homeProbablePitcher || buildEmptyMlbPitcher(),
    awayProbablePitcher: game.awayProbablePitcher || buildEmptyMlbPitcher(),
  };
}

export function isNhlLiveGameFinal(game = {}) {
  const s1 = safeUpper(game?.gameState);
  const s2 = safeUpper(game?.gameStatus);
  const s3 = safeUpper(game?.state);

  return (
    game?.isFinal === true ||
    s1.includes("FINAL") ||
    s2.includes("FINAL") ||
    s3.includes("FINAL") ||
    s1 === "OFF" ||
    s2 === "OFF" ||
    s3 === "OFF" ||
    s1 === "OFFICIAL" ||
    s2 === "OFFICIAL" ||
    s3 === "OFFICIAL"
  );
}

export function extractNhlOfficialResult(game = {}, challenge = {}) {
  const awayScore = Number(game.awayScore ?? game.away?.score ?? 0);
  const homeScore = Number(game.homeScore ?? game.home?.score ?? 0);

  const awayAbbr = safeUpper(challenge.awayAbbr);
  const homeAbbr = safeUpper(challenge.homeAbbr);

  let winnerAbbr = null;
  if (awayScore > homeScore) winnerAbbr = awayAbbr;
  else if (homeScore > awayScore) winnerAbbr = homeAbbr;

  let outcome = "REG";
  if (game.periodType === "OT") outcome = "OT";
  if (game.periodType === "SO") outcome = "TB";

  return {
    winnerAbbr,
    awayScore,
    homeScore,
    outcome,
  };
}

export async function fetchMlbLiveFeed(gamePk) {
  const url = MLB_LIVE_FEED_URL(gamePk);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });

  if (!res.ok) {
    throw new Error(`MLB live feed failed ${res.status}`);
  }

  return res.json();
}

function teamAbbrFromNode(node) {
  const abbr = node?.abbreviation || node?.team?.abbreviation || "";
  return safeUpper(abbr) || null;
}

export function isMlbLiveGameFinal(liveFeed = {}) {
  const abs = String(liveFeed?.gameData?.status?.abstractGameState || "").toLowerCase();
  const detailed = String(liveFeed?.gameData?.status?.detailedState || "").toLowerCase();
  const coded = String(liveFeed?.gameData?.status?.statusCode || "").toLowerCase();
  const inningState = String(liveFeed?.liveData?.linescore?.currentInningState || "").toLowerCase();

  return (
    abs === "final" ||
    detailed.includes("final") ||
    coded === "f" ||
    inningState === "final"
  );
}

export function extractMlbOfficialResult(liveFeed = {}, challenge = {}) {
  const linescore = liveFeed?.liveData?.linescore || {};
  const awayNode = liveFeed?.gameData?.teams?.away || {};
  const homeNode = liveFeed?.gameData?.teams?.home || {};

  const awayScore = Number(linescore?.teams?.away?.runs ?? awayNode?.score ?? 0);
  const homeScore = Number(linescore?.teams?.home?.runs ?? homeNode?.score ?? 0);

  const awayAbbr = safeUpper(challenge.awayAbbr) || teamAbbrFromNode(awayNode);
  const homeAbbr = safeUpper(challenge.homeAbbr) || teamAbbrFromNode(homeNode);

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
