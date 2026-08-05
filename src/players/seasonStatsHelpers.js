/** Saison MLB (année civile) et NHL (YYYYYYYY, bascule juillet). */

import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import { defaultMlbSeasonBounds } from "@src/season/seasonCompetitionCore";

export function getMlbCurrentSeason(date = new Date()) {
  return String(date.getUTCFullYear());
}

export function getMlbPreviousSeason(date = new Date()) {
  return String(Number(getMlbCurrentSeason(date)) - 1);
}

export function getNhlCurrentSeasonId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
}

export function getNhlPreviousSeasonId(seasonId) {
  const s = String(seasonId || getNhlCurrentSeasonId());
  if (!/^\d{8}$/.test(s)) return null;
  const start = Number(s.slice(0, 4));
  if (!Number.isFinite(start)) return null;
  return `${start - 1}${start}`;
}

/**
 * Saison NHL à afficher pour les leaders patineurs.
 * Avant le début de la saison régulière calendaire, on retombe sur la saison précédente.
 */
export function resolveNhlLeadersSeasonId({
  date = new Date(),
  seasonConfig = null,
  todayYmd = null,
} = {}) {
  const calendarSeasonId = getNhlCurrentSeasonId(date);
  const ymd = String(todayYmd || getProphetikBusinessYmd(date)).slice(0, 10);

  const calStartYear = Number(calendarSeasonId.slice(0, 4));
  let rsStart = `${calStartYear}-10-01`;

  const cfg = seasonConfig || {};
  if (String(cfg.seasonId || "") === calendarSeasonId) {
    rsStart = String(
      cfg.regularSeasonStartYmd ||
        cfg.regularSeasonStartDate ||
        cfg.fromYmd ||
        rsStart
    ).slice(0, 10);
  }

  const previousId = getNhlPreviousSeasonId(calendarSeasonId);
  if (previousId && ymd < rsStart) {
    return {
      seasonId: previousId,
      calendarSeasonId,
      isPreviousSeason: true,
    };
  }

  return {
    seasonId: calendarSeasonId,
    calendarSeasonId,
    isPreviousSeason: false,
  };
}

/**
 * Saison MLB à afficher pour les leaders frappeurs.
 * Avant l'ouverture de la saison régulière, on retombe sur la saison précédente.
 */
export function resolveMlbLeadersSeasonId({
  date = new Date(),
  seasonConfig = null,
  todayYmd = null,
} = {}) {
  const calendarSeasonId = getMlbCurrentSeason(date);
  const ymd = String(todayYmd || getProphetikBusinessYmd(date)).slice(0, 10);
  const bounds = defaultMlbSeasonBounds(calendarSeasonId);
  let rsStart = bounds.regular.fromYmd;

  const cfg = seasonConfig || {};
  if (
    String(cfg.sport || "").toLowerCase() === "mlb" &&
    String(cfg.seasonId || "") === calendarSeasonId
  ) {
    rsStart = String(
      cfg.regularSeasonStartYmd ||
        cfg.regularSeasonStartDate ||
        cfg.fromYmd ||
        rsStart
    ).slice(0, 10);
  }

  const previousId = getMlbPreviousSeason(date);
  if (previousId && ymd < rsStart) {
    return {
      seasonId: previousId,
      calendarSeasonId,
      isPreviousSeason: true,
    };
  }

  return {
    seasonId: calendarSeasonId,
    calendarSeasonId,
    isPreviousSeason: false,
  };
}

export function getSeasonPairForLeague(league, date = new Date()) {
  const L = String(league || "NHL").toUpperCase();
  if (L === "MLB") {
    const current = getMlbCurrentSeason(date);
    return { current, previous: getMlbPreviousSeason(date) };
  }
  const current = getNhlCurrentSeasonId(date);
  return { current, previous: getNhlPreviousSeasonId(current) };
}

export function formatSeasonLabel(league, seasonId) {
  const L = String(league || "NHL").toUpperCase();
  const s = String(seasonId || "");
  if (L === "MLB") return s;
  if (!/^\d{8}$/.test(s)) return s;
  return `${s.slice(0, 4)}-${s.slice(6, 8)}`;
}

/** Seuil dynamique de qualification pour % et OPS (règle MLB : 3,1 PA par match d'équipe). */
export const MLB_REGULAR_SEASON_GAMES = 162;
export const MLB_PA_PER_TEAM_GAME = 3.1;
export const MLB_RATE_STAT_MIN_PA_FLOOR = 50;

export const MLB_RATE_STAT_SORT_FIELDS = new Set(["battingAverage", "ops"]);

export function isMlbRateStatSortField(sortField) {
  return MLB_RATE_STAT_SORT_FIELDS.has(String(sortField || ""));
}

function ymdToUtcDate(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function resolveMlbRegularSeasonBounds(seasonId, seasonConfig = null) {
  const bounds = defaultMlbSeasonBounds(seasonId);
  let rsStart = bounds.regular.fromYmd;
  let rsEnd = bounds.regular.toYmd;

  const cfg = seasonConfig || {};
  if (
    String(cfg.sport || "").toLowerCase() === "mlb" &&
    String(cfg.seasonId || "") === String(seasonId)
  ) {
    rsStart = String(
      cfg.regularSeasonStartYmd ||
        cfg.regularSeasonStartDate ||
        cfg.fromYmd ||
        rsStart
    ).slice(0, 10);
    rsEnd = String(cfg.regularSeasonEndYmd || cfg.toYmd || rsEnd).slice(0, 10);
  }

  return { rsStart, rsEnd };
}

/** Estime les matchs joués par une équipe selon la progression calendaire de la saison. */
export function estimateMlbTeamGamesPlayedFromCalendar({
  todayYmd,
  seasonStartYmd,
  seasonEndYmd,
  totalGames = MLB_REGULAR_SEASON_GAMES,
} = {}) {
  const today = String(todayYmd || "").slice(0, 10);
  const start = String(seasonStartYmd || "").slice(0, 10);
  const end = String(seasonEndYmd || "").slice(0, 10);

  if (!start || !end) return 0;
  if (today <= start) return 0;
  if (today >= end) return totalGames;

  const startDt = ymdToUtcDate(start);
  const endDt = ymdToUtcDate(end);
  const todayDt = ymdToUtcDate(today);
  if (!startDt || !endDt || !todayDt) return 0;

  const totalMs = endDt.getTime() - startDt.getTime();
  const elapsedMs = todayDt.getTime() - startDt.getTime();
  if (totalMs <= 0) return 0;

  const ratio = Math.min(1, Math.max(0, elapsedMs / totalMs));
  return Math.min(totalGames, Math.round(ratio * totalGames));
}

export function computeMlbRateStatMinPlateAppearances({
  date = new Date(),
  seasonConfig = null,
  seasonId = null,
  isPreviousSeason = false,
  todayYmd = null,
} = {}) {
  if (isPreviousSeason) {
    return Math.ceil(MLB_PA_PER_TEAM_GAME * MLB_REGULAR_SEASON_GAMES);
  }

  const ymd = String(todayYmd || getProphetikBusinessYmd(date)).slice(0, 10);
  const { rsStart, rsEnd } = resolveMlbRegularSeasonBounds(seasonId, seasonConfig);
  const teamGames = estimateMlbTeamGamesPlayedFromCalendar({
    todayYmd: ymd,
    seasonStartYmd: rsStart,
    seasonEndYmd: rsEnd,
  });

  const minPa = Math.round(teamGames * MLB_PA_PER_TEAM_GAME);
  return Math.max(MLB_RATE_STAT_MIN_PA_FLOOR, minPa);
}

export function isMlbBatterQualifiedForRateStat(row, minPa) {
  const threshold = Number(minPa) || 0;
  const pa = Number(row?.plateAppearances);
  if (Number.isFinite(pa) && pa >= threshold) return true;

  const ab = Number(row?.atBats);
  if (Number.isFinite(ab) && ab >= threshold) return true;

  return false;
}

export function normalizeStatsBySeason(raw) {
  if (!raw || typeof raw !== "object") return {};

  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    if ("rbi" in value || "homeRuns" in value || "goals" in value || "points" in value) {
      out[String(key)] = value;
    }
  }
  return out;
}

export function getSeasonStats(statsBySeason, seasonId) {
  const map = normalizeStatsBySeason(statsBySeason);
  const sid = String(seasonId || "");
  if (!sid) return null;

  return map[sid] || map[Number(sid)] || null;
}

function hasMlbStats(stats) {
  if (!stats || typeof stats !== "object") return false;
  return (
    Number(stats.rbi) > 0 ||
    Number(stats.homeRuns) > 0 ||
    Number(stats.gamesPlayed) > 0 ||
    !!stats.battingAverage
  );
}

function hasNhlStats(stats) {
  if (!stats || typeof stats !== "object") return false;
  return (
    Number(stats.goals) > 0 ||
    Number(stats.assists) > 0 ||
    Number(stats.points) > 0 ||
    Number(stats.gamesPlayed) > 0
  );
}

export function formatMlbStatsLine(stats) {
  if (!hasMlbStats(stats)) return null;
  const rbi = Number(stats.rbi) || 0;
  const hr = Number(stats.homeRuns) || 0;
  const avg = stats.battingAverage ?? "—";
  const gp = Number(stats.gamesPlayed) || 0;
  return `${rbi} RBI · ${hr} HR · ${avg} (${gp} GP)`;
}

export function formatNhlStatsLine(stats) {
  if (!hasNhlStats(stats)) return null;
  const g = Number(stats.goals) || 0;
  const a = Number(stats.assists) || 0;
  const pts = Number(stats.points) || g + a;
  const gp = Number(stats.gamesPlayed) || 0;
  return `${g}G · ${a}A · ${pts} PTS (${gp} GP)`;
}

export function getPlayerSeasonStatLines(player, league, seasonPair) {
  const L = String(league || "NHL").toUpperCase();
  const statsBySeason = player?.statsBySeason || {};
  const formatLine = L === "MLB" ? formatMlbStatsLine : formatNhlStatsLine;
  const lines = [];

  for (const seasonId of [seasonPair?.current, seasonPair?.previous].filter(Boolean)) {
    const stats = getSeasonStats(statsBySeason, seasonId);
    const line = formatLine(stats);
    if (line) {
      lines.push({
        seasonId: String(seasonId),
        label: formatSeasonLabel(L, seasonId),
        line,
      });
    }
  }

  return lines;
}

export function getFgcPlayerStatChips(player, league, seasonPair) {
  const L = String(league || "NHL").toUpperCase();
  const stats = getSeasonStats(player?.statsBySeason, seasonPair?.current);
  if (!stats || typeof stats !== "object") return [];

  if (L === "MLB") {
    if (!hasMlbStats(stats)) return [];
    const chips = [];
    const rbi = Number(stats.rbi);
    const hr = Number(stats.homeRuns);
    const gp = Number(stats.gamesPlayed);
    if (Number.isFinite(rbi)) chips.push({ key: "rbi", value: String(rbi), label: "RBI" });
    if (Number.isFinite(hr)) chips.push({ key: "hr", value: String(hr), label: "HR" });
    if (stats.battingAverage) chips.push({ key: "avg", value: String(stats.battingAverage), label: "AVG" });
    else if (stats.ops) chips.push({ key: "ops", value: String(stats.ops), label: "OPS" });
    if (gp > 0) chips.push({ key: "gp", value: String(gp), label: "GP" });
    return chips;
  }

  if (!hasNhlStats(stats)) return [];

  const g = Number(stats.goals) || 0;
  const a = Number(stats.assists) || 0;
  const pts = Number(stats.points) || g + a;
  const gp = Number(stats.gamesPlayed) || 0;
  const chips = [
    { key: "g", value: String(g), label: "G" },
    { key: "a", value: String(a), label: "A" },
    { key: "pts", value: String(pts), label: "PTS" },
  ];
  if (gp > 0) chips.push({ key: "gp", value: String(gp), label: "GP" });
  return chips;
}

export function getFgcPlayerPreviousSeasonLine(player, league, seasonPair) {
  const L = String(league || "NHL").toUpperCase();
  const previousId = seasonPair?.previous;
  if (!previousId) return null;
  const stats = getSeasonStats(player?.statsBySeason, previousId);
  const formatLine = L === "MLB" ? formatMlbStatsLine : formatNhlStatsLine;
  const line = formatLine(stats);
  if (!line) return null;
  return {
    seasonId: String(previousId),
    label: formatSeasonLabel(L, previousId),
    line,
  };
}

export function getPlayerSortValue(player, league, seasonPair) {
  const L = String(league || "NHL").toUpperCase();
  const statsBySeason = player?.statsBySeason || {};
  const primaryKey = L === "MLB" ? "rbi" : "goals";
  const currentStats = getSeasonStats(statsBySeason, seasonPair?.current);
  const previousStats = getSeasonStats(statsBySeason, seasonPair?.previous);
  const current = Number(currentStats?.[primaryKey] ?? 0);
  const previous = Number(previousStats?.[primaryKey] ?? 0);
  return current > 0 ? current : previous;
}
