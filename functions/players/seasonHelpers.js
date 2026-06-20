/**
 * Helpers de saison pour MLB (année civile) et NHL (YYYYYYYY, bascule juillet).
 */

export function getMlbCurrentSeason(date = new Date()) {
  return String(date.getUTCFullYear());
}

export function getMlbPreviousSeason(date = new Date()) {
  return String(Number(getMlbCurrentSeason(date)) - 1);
}

export function getMlbSeasonPair(date = new Date()) {
  const current = getMlbCurrentSeason(date);
  return { current, previous: getMlbPreviousSeason(date) };
}

/** Saison NHL au format 20252026 (juillet → juin). */
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

export function getNhlSeasonPair(date = new Date()) {
  const current = getNhlCurrentSeasonId(date);
  return { current, previous: getNhlPreviousSeasonId(current) };
}
