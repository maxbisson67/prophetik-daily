import { resolveTsLeaderboardStats } from "./tsLeaderboardStats";

export default function normalizeMemberRow(row) {
  const r = row || {};

  const fgcPoints = Number(r.fgcPoints ?? r?.families?.fgc?.points ?? 0) || 0;
  const tpPoints = Number(r.tpPoints ?? r?.families?.tp?.points ?? 0) || 0;

  const tsStats = resolveTsLeaderboardStats(r);
  const tsPoints = tsStats.points;
  const tsWins = tsStats.wins;
  const tsPlays = tsStats.plays;

  const pointsTotal =
    Number(r.pointsTotal ?? fgcPoints + tpPoints + tsPoints + dailyBonusPoints) || 0;

  const fgcWins = Number(r.fgcWins ?? r?.families?.fgc?.wins ?? 0) || 0;
  const tpWins = Number(r.tpWins ?? r?.families?.tp?.wins ?? 0) || 0;
  const tpExactWins = Number(r.tpExactWins ?? r?.families?.tp?.exacts ?? 0) || 0;
  const dailyBonusWins = Number(r.dailyBonusWins ?? r?.families?.daily?.wins ?? 0) || 0;
  const dailyBonusPoints = Number(r.dailyBonusPoints ?? r?.families?.daily?.points ?? 0) || 0;

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
    tsWins,
    tsPlays,
    pointsTotal,
    fgcWins,
    tpWins,
    tpExactWins,
    dailyBonusWins,
    dailyBonusPoints,
    wins,
    participations,
    winRate,
    nhlPointsTotal,
    nhlGamesTotal,
    nhlPPG,
    families: {
      ...(r.families || {}),
      ts: {
        ...(r.families?.ts || r.families?.standard || {}),
        points: tsPoints,
        wins: tsWins,
        plays: tsPlays,
      },
    },
  };
}
