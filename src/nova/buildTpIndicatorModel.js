import { normalizePitcherIndicator } from "@src/nova/novaIndicatorTheme";

function mapTeamSide(side) {
  if (!side?.abbr) return null;
  const form = side.form || {};
  return {
    abbr: side.abbr,
    seasonRecord: form.seasonRecord || null,
    runsScoredPerGame: form.runsScoredPerGame ?? null,
    runsAllowedPerGame: form.runsAllowedPerGame ?? null,
    runDifferential: form.runDifferential ?? null,
    lastTen: form.lastTen || null,
    streak: form.streak || null,
    splitRecord: form.splitRecord || null,
    pitcher: normalizePitcherIndicator(side.pitcher, { teamAbbr: side.abbr }),
  };
}

function formatParticipantPick(pick, awayAbbr, homeAbbr) {
  if (!pick) return null;
  const away = Number(pick.predictedAwayScore);
  const home = Number(pick.predictedHomeScore);
  if (!Number.isFinite(away) || !Number.isFinite(home)) return null;
  return {
    awayScore: away,
    homeScore: home,
    label: `${awayAbbr || "?"} ${away} – ${home} ${homeAbbr || "?"}`,
    winnerAbbr: pick.winnerAbbr || null,
  };
}

/**
 * @param {{ indicators?: object|null, novaResponse?: object|null, lang?: string }} params
 */
export function buildTpIndicatorModel({ indicators, novaResponse, lang = "fr" }) {
  if (!indicators) return null;

  return {
    verdict: {
      confidence: novaResponse?.confidence || "medium",
    },
    match: {
      slot: indicators.slot ?? null,
      awayAbbr: indicators.awayAbbr || null,
      homeAbbr: indicators.homeAbbr || null,
    },
    away: mapTeamSide(indicators.away),
    home: mapTeamSide(indicators.home),
    participantPick: formatParticipantPick(
      indicators.participantPick,
      indicators.awayAbbr,
      indicators.homeAbbr
    ),
    risks: Array.isArray(novaResponse?.risks) ? novaResponse.risks.filter(Boolean) : [],
    reflection: novaResponse?.reflection || "",
    lang,
  };
}
