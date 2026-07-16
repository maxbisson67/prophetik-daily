import { isBvpActionableForCoach } from "../../mlb/mlbBvpStats.js";

/**
 * Snapshot vérifié pour la vue Indicateurs Nova (FGC MLB / NHL).
 * @param {object|null} verifiedContext
 */
export function buildFgcIndicatorsMeta(verifiedContext) {
  if (verifiedContext?.domain !== "fgc") return null;

  const sport = String(verifiedContext?.sport || "").toUpperCase();
  const pick = verifiedContext?.participant?.currentPick || null;
  const focusPlayer =
    (verifiedContext?.players || []).find((p) => p.playerId === pick?.playerId) ||
    verifiedContext?.players?.[0] ||
    null;

  if (sport === "MLB") {
    const matchup = verifiedContext?.matchup || null;
    const bvp = matchup?.bvp || null;
    const bvpPa = Number(bvp?.pa) || 0;
    const dynamics = matchup?.firstInningRbiDynamics || null;

    return {
      sport: "MLB",
      player: focusPlayer
        ? {
            playerId: focusPlayer.playerId,
            fullName: focusPlayer.fullName,
            teamAbbr: focusPlayer.teamAbbr,
            batSide: pick?.batSide || focusPlayer.batSide || null,
            lineupSlot: pick?.lineupSlot ?? focusPlayer.lineupSlot ?? null,
            isAwayTeam: pick?.isAwayTeam === true || focusPlayer.isAwayTeam === true,
            isHomeTeam: pick?.isHomeTeam === true || focusPlayer.isHomeTeam === true,
            seasonStats: focusPlayer.seasonStats || null,
          }
        : null,
      lineup: {
        slot: pick?.lineupSlot ?? focusPlayer?.lineupSlot ?? null,
        note: dynamics?.lineupNote || null,
        halfInning: dynamics?.halfInning || null,
        isAwayTeam: pick?.isAwayTeam === true || focusPlayer?.isAwayTeam === true,
        batsFirstInGame: matchup?.batsFirstInGame === true,
      },
      platoon: matchup?.platoon || null,
      opposingPitcher: matchup?.opposingPitcher || null,
      opposingTeamAbbr: matchup?.opposingTeamAbbr || null,
      opposingTeamForm: matchup?.opposingTeamForm || null,
      bvp: bvpPa > 0 ? bvp : null,
      bvpActionable: isBvpActionableForCoach(bvp),
      bvpPa,
    };
  }

  if (sport === "NHL") {
    return {
      sport: "NHL",
      player: focusPlayer
        ? {
            playerId: focusPlayer.playerId,
            fullName: focusPlayer.fullName,
            teamAbbr: focusPlayer.teamAbbr,
            position: focusPlayer.position || null,
            isAwayTeam: focusPlayer.isAwayTeam === true,
            isHomeTeam: focusPlayer.isHomeTeam === true,
            seasonStats: focusPlayer.seasonStats || null,
            injury: focusPlayer.injury || null,
          }
        : null,
      challenge: {
        homeAbbr: verifiedContext?.challenge?.homeAbbr || null,
        awayAbbr: verifiedContext?.challenge?.awayAbbr || null,
      },
    };
  }

  return null;
}
