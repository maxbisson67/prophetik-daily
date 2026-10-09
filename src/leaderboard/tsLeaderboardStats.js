/** Somme des points NHL TRIO par format (1x1 … 7x7). */
export function aggregateTsNhlPointsFromWinsByType(winsByType) {
  let points = 0;
  const map = winsByType && typeof winsByType === "object" ? winsByType : {};

  for (const [key, raw] of Object.entries(map)) {
    const typeNum = Number(key);
    if (!Number.isFinite(typeNum) || typeNum < 1 || typeNum > 7) continue;
    const entry = raw || {};
    points += Number(entry.nhlPointsTotal ?? 0) || 0;
  }

  return points;
}

export function aggregateTsPlaysFromWinsByType(winsByType) {
  let wins = 0;
  let plays = 0;

  const map = winsByType && typeof winsByType === "object" ? winsByType : {};

  for (const [key, raw] of Object.entries(map)) {
    const typeNum = Number(key);
    if (!Number.isFinite(typeNum) || typeNum < 1 || typeNum > 7) continue;

    const entry = raw || {};
    wins += Number(entry.wins ?? 0) || 0;
    plays += Number(entry.plays ?? 0) || 0;
  }

  return { wins, plays };
}

/**
 * Points TRIO saison = stats NHL cumulées (pas la cagnotte / payout).
 */
export function resolveTsLeaderboardStats(row = {}) {
  const fam = row?.families?.ts || row?.families?.standard || {};

  const fromNhlTypes = aggregateTsNhlPointsFromWinsByType(row.winsByType);
  let points =
    Number(fam.points ?? row.tsPoints ?? row.standardPoints ?? 0) || 0;

  if (fromNhlTypes > 0) {
    if (points === 0 || points > fromNhlTypes) {
      points = fromNhlTypes;
    }
  }

  let wins = Number(fam.wins ?? row.tsWins ?? row.standardWins ?? 0) || 0;
  let plays = Number(fam.plays ?? row.tsPlays ?? 0) || 0;

  if (plays === 0 && row.winsByType) {
    const fromTypes = aggregateTsPlaysFromWinsByType(row.winsByType);
    wins = fromTypes.wins || wins;
    plays = fromTypes.plays || plays;
  }

  return { points, wins, plays };
}

/** @deprecated Ne pas sommer winsByType.pointsTotal (historique payout). */
export function aggregateTsFromWinsByType(winsByType) {
  const { wins, plays } = aggregateTsPlaysFromWinsByType(winsByType);
  return { points: aggregateTsNhlPointsFromWinsByType(winsByType), wins, plays };
}
