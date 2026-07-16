import { isBvpActionableForCoach } from "../../mlb/mlbBvpStats.js";

/**
 * Snapshot vérifié pour la vue Indicateurs Nova (TS MLB).
 * @param {object|null} verifiedContext
 */
export function buildTsIndicatorsMeta(verifiedContext) {
  if (verifiedContext?.domain !== "ts" || verifiedContext?.sport !== "MLB") {
    return null;
  }

  const player = verifiedContext.player || verifiedContext.players?.[0] || null;
  const matchup = verifiedContext.matchup || null;
  const bvp = matchup?.bvp || player?.bvpVsOpposingStarter || null;
  const bvpPa = Number(bvp?.pa) || 0;

  return {
    offensiveEnvironment: verifiedContext.offensiveEnvironment || null,
    player: player
      ? {
          playerId: player.playerId,
          fullName: player.fullName,
          teamAbbr: player.teamAbbr,
          seasonStats: player.seasonStats || null,
        }
      : null,
    opposingPitcher: matchup?.opposingPitcher || null,
    opposingTeamAbbr: matchup?.opposingTeamAbbr || null,
    bvp: bvpPa > 0 ? bvp : null,
    bvpActionable: isBvpActionableForCoach(bvp),
    bvpPa,
    scoring: verifiedContext.scoring || null,
  };
}
