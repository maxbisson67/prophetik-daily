import {
  computeParkTempContextScore,
  formatSlg,
  normalizePitcherIndicator,
  scoreToLabel,
  statTier,
} from "@src/nova/novaIndicatorTheme";

function computeTemperatureScoreClient(tempC) {
  const t = Number(tempC);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.min(100, Math.round(50 + (t - 20) * 1.5)));
}

function pickStatsFromPlayer(player) {
  if (!player) return null;
  return {
    hits: Number(player.hits) || 0,
    rbi: Number(player.rbi) || 0,
    runs: Number(player.runs) || 0,
    homeRuns: Number(player.homeRuns) || 0,
    slg: player.slg ?? null,
  };
}

function parseSlgNum(slg) {
  const raw = String(slg ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.startsWith(".") ? `0${raw}` : raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ indicators?: object|null, novaResponse?: object|null, player?: object|null, lang?: string }} params
 */
export function buildTsIndicatorModel({ indicators, novaResponse, player, lang = "fr" }) {
  const env = indicators?.offensiveEnvironment || null;
  const stats = indicators?.player?.seasonStats || pickStatsFromPlayer(player);
  const bvp = indicators?.bvp || player?.bvpVsOpposingStarter || null;
  const bvpPa = Number(indicators?.bvpPa ?? bvp?.pa) || 0;
  const bvpActionable =
    indicators?.bvpActionable === true || (bvpPa > 9 && bvp?.hasSample !== false);
  const rawPitcher = indicators?.opposingPitcher || player?.opponentProbablePitcher || null;

  const weatherNeutralized = env?.weatherNeutralized === true;
  const parkScore = env?.parkScore ?? null;
  const temperatureScore =
    env?.temperatureScore ??
    (env?.temperatureCelsius != null ? computeTemperatureScoreClient(env.temperatureCelsius) : null);
  const contextScore =
    env?.contextScore ??
    computeParkTempContextScore(parkScore, temperatureScore, weatherNeutralized);

  const globalScore = env?.score ?? null;
  const globalLabel = env?.label || scoreToLabel(globalScore);
  const contextLabel = env?.contextLabel || scoreToLabel(contextScore);

  const slgNum = parseSlgNum(stats?.slg);

  return {
    verdict: {
      excerpt: novaResponse?.observation || "",
      confidence: novaResponse?.confidence || "medium",
      pitchingNote: novaResponse?.comparison?.pitchingNote || null,
    },
    environment: {
      globalScore,
      globalLabel,
      contextScore,
      contextLabel,
      ballparkName: env?.ballparkName || null,
      parkScore,
      temperatureCelsius: env?.temperatureCelsius ?? null,
      temperatureScore,
      windSpeedKmh: env?.windSpeedKmh ?? null,
      windDirectionText: env?.windDirectionText || null,
      weatherNeutralized,
      altitudeMeters: env?.altitudeMeters ?? null,
      parkFactorHomeRuns: env?.parkFactorHomeRuns ?? null,
      explanation:
        lang === "en"
          ? env?.explanationEn || env?.explanationFr || ""
          : env?.explanationFr || env?.explanationEn || "",
    },
    stats: stats
      ? {
          hits: stats.hits ?? 0,
          runs: stats.runs ?? 0,
          rbi: stats.rbi ?? 0,
          slg: formatSlg(stats.slg),
          slgTier: statTier(slgNum, "slg"),
        }
      : null,
    pitcher: normalizePitcherIndicator(rawPitcher, {
      teamAbbr: indicators?.opposingTeamAbbr || player?.opponentTeamAbbr || null,
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
    risks: Array.isArray(novaResponse?.risks) ? novaResponse.risks.filter(Boolean) : [],
    reflection: novaResponse?.reflection || "",
  };
}

export function supportsTsIndicatorView(domain, sport) {
  return String(domain || "").toLowerCase() === "ts" && String(sport || "").toUpperCase() === "MLB";
}
