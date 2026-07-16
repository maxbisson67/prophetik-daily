import { buildEmptyMlbPitcher } from "../mlb/mlbProbablePitchers.js";
import {
  getDateValue,
  normalizeLeague,
  safeUpper,
} from "../teamPredictionChallenges/tpGameSources.js";
import {
  TP_BUNDLE_MAX_GAMES,
  TP_LOCK_BEFORE_MINUTES,
  buildBundleGameSlot,
  gameInvolvesFavorite,
  normalizeTeamAbbr,
} from "./tpBundleUtils.js";

function isNhlGameTerminated(gameState) {
  return safeUpper(gameState) === "OFF";
}

function isMlbGameTerminated(status = {}) {
  const abstract = safeUpper(status?.abstractGameState);
  const coded = safeUpper(status?.codedGameState || status?.statusCode);
  return abstract === "FINAL" || coded === "F";
}

function normalizeNhlScheduleDoc(data = {}) {
  const awayAbbr = safeUpper(data.away?.abbr);
  const homeAbbr = safeUpper(data.home?.abbr);
  const startDate = getDateValue(data.startTimeUTC);

  return {
    gameId: String(data.gameId || ""),
    league: "NHL",
    awayAbbr,
    homeAbbr,
    awayTeamId: String(data.away?.teamId || data.away?.id || ""),
    homeTeamId: String(data.home?.teamId || data.home?.id || ""),
    startDate,
    gameState: safeUpper(data.gameState),
  };
}

function normalizeMlbScheduleDoc(data = {}, docId = "") {
  const awayAbbr = safeUpper(data.awayTeam?.abbreviation);
  const homeAbbr = safeUpper(data.homeTeam?.abbreviation);
  const startDate = getDateValue(data.startTimeUTC) || getDateValue(data.gameDateRaw);

  return {
    gameId: String(data.gamePk || docId || ""),
    league: "MLB",
    awayAbbr,
    homeAbbr,
    awayTeamId: String(data.awayTeam?.id || data.awayTeam?.teamId || ""),
    homeTeamId: String(data.homeTeam?.id || data.homeTeam?.teamId || ""),
    startDate,
    status: data.status || null,
    awayProbablePitcher: data.awayProbablePitcher || buildEmptyMlbPitcher(),
    homeProbablePitcher: data.homeProbablePitcher || buildEmptyMlbPitcher(),
  };
}

export function isEligibleTpScheduleGame(game, league, nowMs = Date.now()) {
  if (!game?.gameId || !game?.startDate) return false;
  if (game.startDate.getTime() <= nowMs) return false;
  if (game.startDate.getTime() - nowMs < TP_LOCK_BEFORE_MINUTES * 60 * 1000) return false;

  if (normalizeLeague(league) === "MLB") {
    return !isMlbGameTerminated(game.status || {});
  }

  return !isNhlGameTerminated(game.gameState);
}

export async function loadEligibleScheduleGames(db, { league, gameYmd }) {
  const lg = normalizeLeague(league);
  const collectionPath =
    lg === "MLB"
      ? `mlb_schedule_daily/${gameYmd}/games`
      : `nhl_schedule_daily/${gameYmd}/games`;

  const snap = await db.collection(collectionPath).get();
  const nowMs = Date.now();

  const games = snap.docs
    .map((doc) => {
      const data = doc.data() || {};
      return lg === "MLB"
        ? normalizeMlbScheduleDoc(data, doc.id)
        : normalizeNhlScheduleDoc(data);
    })
    .filter((g) => isEligibleTpScheduleGame(g, lg, nowMs))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return games;
}

function shuffleInPlace(arr = []) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resolveFavoriteGameForGroup(pool = [], group = {}, league) {
  const favoriteTeam = group?.favoriteTeam || null;
  if (!favoriteTeam) return null;

  const lg = normalizeLeague(league);
  const favSport = String(favoriteTeam.sport || group?.sport || "").toUpperCase();
  if (favSport && favSport !== lg) return null;

  return pool.find((g) => gameInvolvesFavorite(g, favoriteTeam)) || null;
}

export function selectGamesForTpBundle({
  games = [],
  group = {},
  league,
  maxGames = TP_BUNDLE_MAX_GAMES,
}) {
  const pool = Array.isArray(games) ? [...games] : [];
  if (!pool.length) {
    return { games: [], gameCount: 0 };
  }

  const selected = [];
  const usedGameIds = new Set();

  const favoriteGame = resolveFavoriteGameForGroup(pool, group, league);

  if (favoriteGame) {
    selected.push({ ...favoriteGame, isFavoriteGame: true });
    usedGameIds.add(favoriteGame.gameId);
  }

  const remaining = shuffleInPlace(pool.filter((g) => !usedGameIds.has(g.gameId)));

  for (const game of remaining) {
    if (selected.length >= maxGames) break;
    selected.push({ ...game, isFavoriteGame: false });
    usedGameIds.add(game.gameId);
  }

  return {
    games: selected.slice(0, maxGames),
    gameCount: Math.min(selected.length, maxGames),
  };
}

export function buildBundleGamesFromSelection(selectedGames = [], league) {
  return selectedGames.map((game, index) =>
    buildBundleGameSlot({
      slot: index + 1,
      gameId: game.gameId,
      awayAbbr: game.awayAbbr,
      homeAbbr: game.homeAbbr,
      startDate: game.startDate,
      isFavoriteGame: !!game.isFavoriteGame,
      league,
      awayProbablePitcher: game.awayProbablePitcher,
      homeProbablePitcher: game.homeProbablePitcher,
    })
  );
}

export function previewBundleSelection({ games, group, league }) {
  const { games: selected } = selectGamesForTpBundle({ games, group, league });
  return {
    gameCount: selected.length,
    games: selected.map((g) => ({
      gameId: g.gameId,
      awayAbbr: normalizeTeamAbbr(g.awayAbbr),
      homeAbbr: normalizeTeamAbbr(g.homeAbbr),
      startTimeISO: g.startDate?.toISOString?.() || null,
      isFavoriteGame: !!g.isFavoriteGame,
    })),
  };
}
