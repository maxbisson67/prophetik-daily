/** Saison MLB (année civile) et NHL (YYYYYYYY, bascule juillet). */

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
