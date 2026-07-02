/** Agrège les stats TS (formats 1x1 … 7x7) depuis winsByType. */
export function aggregateTsFromWinsByType(winsByType) {
  let points = 0;
  let wins = 0;
  let plays = 0;

  const map = winsByType && typeof winsByType === "object" ? winsByType : {};

  for (const [key, raw] of Object.entries(map)) {
    const typeNum = Number(key);
    if (!Number.isFinite(typeNum) || typeNum < 1 || typeNum > 7) continue;

    const entry = raw || {};
    points += Number(entry.pointsTotal ?? 0) || 0;
    wins += Number(entry.wins ?? 0) || 0;
    plays += Number(entry.plays ?? 0) || 0;
  }

  return { points, wins, plays };
}

/** Stats TS pour le classement (champs dénormalisés + fallback winsByType). */
export function resolveTsLeaderboardStats(row = {}) {
  const fam = row?.families?.ts || row?.families?.standard || {};

  const fromFields = {
    points:
      Number(row.tsPoints ?? row.standardPoints ?? fam.points ?? 0) || 0,
    wins: Number(row.tsWins ?? row.standardWins ?? fam.wins ?? 0) || 0,
    plays: Number(row.tsPlays ?? fam.plays ?? 0) || 0,
  };

  const fromTypes = aggregateTsFromWinsByType(row.winsByType);

  return {
    points: Math.max(fromFields.points, fromTypes.points),
    wins: Math.max(fromFields.wins, fromTypes.wins),
    plays: Math.max(fromFields.plays, fromTypes.plays),
  };
}
