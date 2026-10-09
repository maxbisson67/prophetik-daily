import { resolveNhlPoolRankSeasonForGame } from "@src/defis/nhlPoolRankSeason";
import {
  getNhlGoalsPerGameFromStats,
  getSeasonStats,
  resolveMlbLeadersSeasonId,
} from "@src/players/seasonStatsHelpers";

const MIN_PLAYERS_WITH_CURRENT_STATS = 10;

function playerHasCurrentSeasonSample(player, league, currentSeasonId) {
  const stats = getSeasonStats(player?.statsBySeason, currentSeasonId);
  if (!stats || typeof stats !== "object") return false;

  const L = String(league || "NHL").toUpperCase();
  const gp = Number(stats.gamesPlayed) || 0;

  if (L === "MLB") {
    const rbi = Number(stats.rbi) || 0;
    return rbi > 0 || gp >= 5;
  }

  const g = Number(stats.goals) || 0;
  const a = Number(stats.assists) || 0;
  const pts = Number(stats.points) || g + a;
  return pts > 0 || g > 0 || gp >= 5;
}

export function poolHasRepresentativeCurrentSeason(players, league, currentSeasonId) {
  if (!currentSeasonId || !Array.isArray(players) || !players.length) return false;

  let count = 0;
  for (const p of players) {
    if (playerHasCurrentSeasonSample(p, league, currentSeasonId)) {
      count += 1;
      if (count >= MIN_PLAYERS_WITH_CURRENT_STATS) return true;
    }
  }
  return false;
}

/** Saison utilisée pour trier la liste SOLO (N-1 en début de saison, puis courante). */
export function resolveFgcPlayerSortMeta({
  league,
  gameDateYmd,
  seasonPair,
  seasonConfig = null,
  players = [],
} = {}) {
  const L = String(league || "NHL").toUpperCase();
  const ymd = String(gameDateYmd || "").slice(0, 10);
  const current = seasonPair?.current ? String(seasonPair.current) : "";
  const previous = seasonPair?.previous ? String(seasonPair.previous) : "";

  if (L === "MLB") {
    const date =
      /^\d{4}-\d{2}-\d{2}$/.test(ymd)
        ? new Date(`${ymd}T12:00:00Z`)
        : new Date();
    const leaders = resolveMlbLeadersSeasonId({
      date,
      seasonConfig,
      todayYmd: ymd || undefined,
    });
    let sortSeasonId = leaders.seasonId;
    let sortUsesPreviousSeason = leaders.isPreviousSeason;

    if (
      !sortUsesPreviousSeason &&
      current &&
      previous &&
      !poolHasRepresentativeCurrentSeason(players, L, current)
    ) {
      sortSeasonId = previous;
      sortUsesPreviousSeason = true;
    }

    return {
      sortSeasonId: String(sortSeasonId || current || previous),
      sortUsesPreviousSeason,
      currentSeasonId: current,
      previousSeasonId: previous,
    };
  }

  const rankMeta = resolveNhlPoolRankSeasonForGame({ gameDateYmd: ymd, seasonConfig });
  let sortSeasonId = rankMeta.rankSeasonId;
  let sortUsesPreviousSeason = rankMeta.usedPreviousForRank;

  if (
    !sortUsesPreviousSeason &&
    current &&
    previous &&
    !poolHasRepresentativeCurrentSeason(players, L, current)
  ) {
    sortSeasonId = previous;
    sortUsesPreviousSeason = true;
  }

  return {
    sortSeasonId: String(sortSeasonId || current || previous),
    sortUsesPreviousSeason,
    currentSeasonId: current,
    previousSeasonId: previous,
  };
}

/** Valeur numérique pour le tri SOLO (buts/MJ NHL, RBI MLB). */
export function getFgcPlayerSortStat(player, league, seasonId) {
  const L = String(league || "NHL").toUpperCase();
  const stats = getSeasonStats(player?.statsBySeason, seasonId);
  if (!stats || typeof stats !== "object") return 0;

  if (L === "MLB") {
    return Number(stats.rbi) || 0;
  }

  return getNhlGoalsPerGameFromStats(stats);
}

export function getFgcPlayerSortTag(player, league, seasonId) {
  const L = String(league || "NHL").toUpperCase();
  const value = getFgcPlayerSortStat(player, league, seasonId);
  if (!Number.isFinite(value)) return null;

  return {
    value,
    label: L === "MLB" ? "RBI" : "G",
  };
}
