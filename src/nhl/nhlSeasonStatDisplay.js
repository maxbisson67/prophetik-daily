/** Ligne stats saison NHL normalisée pour l’affichage Trio (PTS = G+A si points API absent/0). */

export function normalizeNhlSeasonStatRow(row = {}) {
  const goals = Number(row.goals) || 0;
  const assists = Number(row.assists) || 0;
  let points = Number(row.points);
  if (!Number.isFinite(points)) {
    points = goals + assists;
  } else if (points <= 0 && goals + assists > 0) {
    points = goals + assists;
  }

  const gamesPlayed = Number(row.gamesPlayed) || 0;
  let pointsPerGame = Number(row.pointsPerGame);
  if (!Number.isFinite(pointsPerGame) || pointsPerGame <= 0) {
    pointsPerGame = gamesPlayed > 0 ? points / gamesPlayed : 0;
  }

  return {
    goals,
    assists,
    points,
    gamesPlayed,
    pointsPerGame,
  };
}
