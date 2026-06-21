export default function normalizeMemberRow(row) {
  const r = row || {};

  const fgcPoints = Number(r.fgcPoints ?? r?.families?.fgc?.points ?? 0) || 0;
  const tpPoints = Number(r.tpPoints ?? r?.families?.tp?.points ?? 0) || 0;
  const tsPoints =
    Number(
      r.tsPoints ??
        r.standardPoints ??
        r?.families?.ts?.points ??
        r?.families?.standard?.points ??
        0
    ) || 0;

  const pointsTotal =
    Number(r.pointsTotal ?? fgcPoints + tpPoints + tsPoints) || 0;

  const fgcWins = Number(r.fgcWins ?? r?.families?.fgc?.wins ?? 0) || 0;
  const tpWins = Number(r.tpWins ?? r?.families?.tp?.wins ?? 0) || 0;
  const tsWins =
    Number(
      r.tsWins ??
        r.standardWins ??
        r?.families?.ts?.wins ??
        r?.families?.standard?.wins ??
        0
    ) || 0;

  const wins = Number(r.wins ?? fgcWins + tpWins + tsWins) || 0;
  const participations = Number(r.participations ?? 0) || 0;
  const winRate = participations > 0 ? wins / participations : 0;

  const nhlPointsTotal = Number(r.nhlPointsTotal ?? 0) || 0;
  const nhlGamesTotal = Number(r.nhlGamesTotal ?? 0) || 0;
  const nhlPPG = Number.isFinite(Number(r.nhlPPG))
    ? Number(r.nhlPPG)
    : nhlGamesTotal > 0
    ? nhlPointsTotal / nhlGamesTotal
    : 0;

  return {
    ...r,
    fgcPoints,
    tpPoints,
    tsPoints,
    pointsTotal,
    fgcWins,
    tpWins,
    tsWins,
    wins,
    participations,
    winRate,
    nhlPointsTotal,
    nhlGamesTotal,
    nhlPPG,
  };
}
