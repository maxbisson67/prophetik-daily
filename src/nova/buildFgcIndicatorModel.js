import {
  mergeFgcOpposingPitcherSources,
  opposingProbablePitcherForPlayer,
} from "@src/mlb/fgcBvpUtils";
import { normalizePitcherIndicator } from "@src/nova/novaIndicatorTheme";

function pickMlbStatsFromPlayer(player) {
  if (!player) return null;
  return {
    rbi: Number(player.rbi) || 0,
    hits: Number(player.hits) || 0,
    homeRuns: Number(player.homeRuns) || 0,
    battingAverage: player.battingAverage ?? null,
  };
}

function pickNhlStatsFromPlayer(player) {
  if (!player) return null;
  return {
    goals: Number(player.goals) || 0,
    assists: Number(player.assists) || 0,
    points: Number(player.points) || 0,
    pointsPerGame: Number(player.pointsPerGame) || 0,
    gamesPlayed: Number(player.gamesPlayed) || 0,
  };
}

function handLabel(code, lang) {
  const c = String(code || "").toUpperCase();
  if (lang === "en") {
    if (c === "L") return "Left";
    if (c === "R") return "Right";
    if (c === "S") return "Switch";
    return c || "—";
  }
  if (c === "L") return "Gaucher";
  if (c === "R") return "Droitier";
  if (c === "S") return "Ambidextre";
  return c || "—";
}

function platoonAdvantageLabel(advantage, lang) {
  const key = String(advantage || "").toLowerCase();
  if (key === "favorable") return lang === "en" ? "Favorable" : "Favorable";
  if (key === "unfavorable") return lang === "en" ? "Unfavorable" : "Défavorable";
  return lang === "en" ? "Neutral" : "Neutre";
}

function lineupSideLabel({ isAwayTeam, isHomeTeam, lang }) {
  if (isAwayTeam) {
    return lang === "en" ? "Away — bats top 1st" : "Visiteur — frappe en haut de la 1re";
  }
  if (isHomeTeam) {
    return lang === "en" ? "Home — bats bottom 1st" : "Domicile — frappe en bas de la 1re";
  }
  return lang === "en" ? "Side unknown" : "Côté inconnu";
}

function buildMlbModel({ indicators, novaResponse, player, lang, probablePitchers, homeAbbr, awayAbbr }) {
  const stats = indicators?.player?.seasonStats || pickMlbStatsFromPlayer(player);
  const bvp = indicators?.bvp || player?.bvpVsOpposingStarter || null;
  const bvpPa = Number(indicators?.bvpPa ?? bvp?.pa) || 0;
  const rawPitcher = mergeFgcOpposingPitcherSources(
    indicators?.opposingPitcher,
    player?.opposingPitcherForBvp,
    player?.opponentProbablePitcher,
    opposingProbablePitcherForPlayer(player, probablePitchers, homeAbbr, awayAbbr)
  );
  const pickTeam = String(player?.teamAbbr || "").trim().toUpperCase();
  const home = String(homeAbbr || "").trim().toUpperCase();
  const away = String(awayAbbr || "").trim().toUpperCase();
  const resolvedOpposingTeamAbbr =
    indicators?.opposingTeamAbbr ||
    player?.opponentTeamAbbr ||
    (pickTeam === home ? away : pickTeam === away ? home : null);
  const bvpActionable =
    indicators?.bvpActionable === true || (bvpPa > 9 && bvp?.hasSample !== false);
  const lineup = indicators?.lineup || {};
  const slot = lineup.slot ?? indicators?.player?.lineupSlot ?? player?.lineupSlot ?? null;

  return {
    verdict: {
      confidence: novaResponse?.confidence || "medium",
    },
    lineup: {
      slot,
      sideLabel: lineupSideLabel({
        isAwayTeam: lineup.isAwayTeam ?? indicators?.player?.isAwayTeam,
        isHomeTeam: indicators?.player?.isHomeTeam,
        lang,
      }),
      note: lineup.note || null,
      batsFirstInGame: lineup.batsFirstInGame === true,
    },
    stats: stats
      ? {
          rbi: stats.rbi ?? 0,
          hits: stats.hits ?? 0,
          homeRuns: stats.homeRuns ?? 0,
          battingAverage: stats.battingAverage ?? null,
        }
      : null,
    platoon: indicators?.platoon
      ? {
          batSide: handLabel(indicators.platoon.batterBatSide, lang),
          batSideCode: String(indicators.platoon.batterBatSide || "").trim().toUpperCase() || null,
          throwHand: handLabel(indicators.platoon.pitcherThrowHand, lang),
          throwHandCode: String(indicators.platoon.pitcherThrowHand || "").trim().toUpperCase() || null,
          advantage: platoonAdvantageLabel(indicators.platoon.typicalAdvantage, lang),
          advantageKey: indicators.platoon.typicalAdvantage || "neutral",
        }
      : null,
    pitcher: normalizePitcherIndicator(rawPitcher, {
      teamAbbr: resolvedOpposingTeamAbbr,
    }),
    bvp:
      bvpPa > 0
        ? {
            pa: bvpPa,
            hits: bvp?.hits ?? 0,
            homeRuns: bvp?.homeRuns ?? 0,
            rbi: bvp?.rbi ?? 0,
            ops: bvp?.ops ?? null,
            batterName:
              indicators?.player?.fullName || player?.fullName || bvp?.batterName || null,
            pitcherName: bvp?.pitcherName || rawPitcher?.name || null,
            actionable: bvpActionable,
            defaultExpanded: bvpActionable,
          }
        : null,
    opposingTeam: indicators?.opposingTeamForm
      ? {
          abbr: indicators?.opposingTeamAbbr || null,
          runsAllowedPerGame: indicators.opposingTeamForm.runsAllowedPerGame ?? null,
          seasonRecord: indicators.opposingTeamForm.seasonRecord || null,
        }
      : indicators?.opposingTeamAbbr
        ? { abbr: indicators.opposingTeamAbbr, runsAllowedPerGame: null, seasonRecord: null }
        : null,
    risks: Array.isArray(novaResponse?.risks) ? novaResponse.risks.filter(Boolean) : [],
    reflection: novaResponse?.reflection || "",
  };
}

function buildNhlModel({ indicators, novaResponse, player, lang }) {
  const stats = indicators?.player?.seasonStats || pickNhlStatsFromPlayer(player);

  return {
    verdict: {
      confidence: novaResponse?.confidence || "medium",
    },
    player: {
      fullName: indicators?.player?.fullName || player?.fullName || null,
      teamAbbr: indicators?.player?.teamAbbr || player?.teamAbbr || null,
      position: indicators?.player?.position || player?.positionCode || null,
      sideLabel: lineupSideLabel({
        isAwayTeam: indicators?.player?.isAwayTeam ?? player?.isAwayTeam,
        isHomeTeam: indicators?.player?.isHomeTeam ?? player?.isHomeTeam,
        lang,
      }),
      injury: indicators?.player?.injury || null,
    },
    stats: stats
      ? {
          goals: stats.goals ?? 0,
          assists: stats.assists ?? 0,
          points: stats.points ?? 0,
          pointsPerGame:
            stats.pointsPerGame > 0
              ? Number(stats.pointsPerGame).toFixed(2)
              : stats.points && stats.gamesPlayed
                ? (stats.points / stats.gamesPlayed).toFixed(2)
                : null,
        }
      : null,
    matchup: indicators?.challenge
      ? {
          awayAbbr: indicators.challenge.awayAbbr,
          homeAbbr: indicators.challenge.homeAbbr,
        }
      : null,
    risks: Array.isArray(novaResponse?.risks) ? novaResponse.risks.filter(Boolean) : [],
    reflection: novaResponse?.reflection || "",
  };
}

/**
 * @param {{ sport: string, indicators?: object|null, novaResponse?: object|null, player?: object|null, lang?: string }} params
 */
export function buildFgcIndicatorModel({
  sport,
  indicators,
  novaResponse,
  player,
  lang = "fr",
  probablePitchers = null,
  homeAbbr = null,
  awayAbbr = null,
}) {
  const s = String(sport || indicators?.sport || "").toUpperCase();
  if (s === "MLB") {
    return buildMlbModel({
      indicators,
      novaResponse,
      player,
      lang,
      probablePitchers,
      homeAbbr,
      awayAbbr,
    });
  }
  if (s === "NHL") return buildNhlModel({ indicators, novaResponse, player, lang });
  return null;
}
