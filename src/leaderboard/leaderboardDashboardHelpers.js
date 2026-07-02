export const FGC_LEADERBOARD_POINTS_PER_WIN = 5;
export const TP_WINNER_BASE_POINTS = 3;
export const TP_EXACT_SCORE_BONUS_POINTS = 3;

export function isMlbSport(sport) {
  return String(sport || "").trim().toUpperCase() === "MLB";
}

export function deriveTpExactCount(row = {}) {
  const stored = Number(row.tpExactWins ?? row?.families?.tp?.exacts ?? NaN);
  if (Number.isFinite(stored) && stored >= 0) return stored;

  const wins = Number(row.tpWins ?? row?.families?.tp?.wins ?? 0) || 0;
  const points = Number(row.tpPoints ?? row?.families?.tp?.points ?? 0) || 0;
  if (wins <= 0 || points <= 0) return 0;

  const derived = Math.round((points - wins * TP_WINNER_BASE_POINTS) / TP_EXACT_SCORE_BONUS_POINTS);
  return derived > 0 ? derived : 0;
}

export function fgcDisplayPoints(row = {}) {
  const wins = Number(row.fgcWins ?? row?.families?.fgc?.wins ?? 0) || 0;
  return wins * FGC_LEADERBOARD_POINTS_PER_WIN;
}
