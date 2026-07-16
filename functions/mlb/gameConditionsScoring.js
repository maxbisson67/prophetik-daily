/**
 * Scoring MVP — environnement offensif d'un match MLB.
 *
 * Pondération globale :
 *   offensiveEnvironmentScore = park×0.60 + weather×0.30 + special×0.10
 *
 * Seuils :
 *   0-39 défavorable · 40-54 neutre · 55-69 favorable · 70-100 très favorable
 */
import { windDirectionText } from "./openMeteoClient.js";

const DEG2RAD = Math.PI / 180;

/** Pente facteurs parc → score (100 neutre). Coors ~111 → ~80. */
const PARK_FACTOR_SLOPE = 2.7;

/** @typedef {'unfavorable'|'neutral'|'favorable'|'very_favorable'} OffensiveEnvironmentLabel */
/** @typedef {'open'|'closed'|'unknown'} RoofState */

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeAngleDiff(a, b) {
  const delta = ((((Number(b) - Number(a)) % 360) + 540) % 360) - 180;
  return delta;
}

/**
 * Vent faible (< ~12 km/h) : impact réduit. Fort (> ~30 km/h) : impact plein.
 * @returns {number} 0..1
 */
export function effectiveWindSpeedFactor(windSpeedKmh) {
  const s = Number(windSpeedKmh);
  if (!Number.isFinite(s) || s <= 0) return 0;
  return clamp((s - 8) / 22, 0, 1);
}

/**
 * Score vent aligné avec la direction « vers l'extérieur » du terrain.
 * @returns {number} -100..+100 (+ = vent sortant)
 */
export function windOutScore(windDirDeg, fieldBearingDeg, windSpeedKmh) {
  const speed = Number(windSpeedKmh);
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  if (!Number.isFinite(Number(windDirDeg)) || !Number.isFinite(Number(fieldBearingDeg))) return 0;

  const delta = normalizeAngleDiff(windDirDeg, fieldBearingDeg);
  const alignment = Math.cos(delta * DEG2RAD);
  const speedFactor = effectiveWindSpeedFactor(speed);
  return alignment * speedFactor * 100;
}

export function windScoreNormalized(windOutToCenter) {
  return clamp(50 + Number(windOutToCenter || 0) * 0.5, 0, 100);
}

/**
 * Facteurs structurels du parc (HR pondéré plus fort — aligné barème TS).
 */
export function computeParkOffenseScore(ballpark = {}) {
  const runs = Number(ballpark.parkFactorRuns);
  const hr = Number(ballpark.parkFactorHomeRuns);
  const hits = Number(ballpark.parkFactorHits);

  const parts = [];
  if (Number.isFinite(runs) && runs > 0) parts.push({ v: runs, w: 0.35 });
  if (Number.isFinite(hr) && hr > 0) parts.push({ v: hr, w: 0.4 });
  if (Number.isFinite(hits) && hits > 0) parts.push({ v: hits, w: 0.25 });

  if (!parts.length) return 50;

  const weightSum = parts.reduce((a, p) => a + p.w, 0);
  const weighted = parts.reduce((a, p) => a + p.v * p.w, 0) / weightSum;

  return clamp(Math.round(50 + (weighted - 100) * PARK_FACTOR_SLOPE), 0, 100);
}

export function computeTemperatureScore(tempC) {
  const t = Number(tempC);
  if (!Number.isFinite(t)) return 50;
  return clamp(Math.round(50 + (t - 20) * 1.5), 0, 100);
}

export function computeHumidityScore(humidityPercent) {
  const h = Number(humidityPercent);
  if (!Number.isFinite(h)) return 50;
  return clamp(Math.round(55 - Math.max(0, h - 70) * 0.25), 0, 100);
}

/** Altitude, toit — bonus structurel léger (10 % du score global). */
export function computeSpecialContextScore(ballpark = {}, roofState = "unknown") {
  if (ballpark.roofType === "dome" || roofState === "closed") {
    return 50;
  }

  let score = 50;
  const alt = Number(ballpark.altitudeMeters);
  if (Number.isFinite(alt) && alt > 0) {
    score += clamp((alt / 1609) * 20, 0, 20);
  }

  return clamp(Math.round(score), 0, 100);
}

/** @deprecated alias */
export function computeEnvironmentScore(ballpark = {}, roofState = "unknown") {
  return computeSpecialContextScore(ballpark, roofState);
}

export function resolveRoofState(ballpark = {}) {
  if (ballpark.roofType === "dome") return "closed";
  if (ballpark.roofType === "retractable") return "unknown";
  return "open";
}

export function isWeatherNeutralized(roofState, ballpark = {}) {
  return roofState === "closed" || ballpark.roofType === "dome";
}

export function computeWeatherOffenseScore({ windScore, temperatureScore, humidityScore }) {
  return clamp(
    Math.round(0.55 * windScore + 0.35 * temperatureScore + 0.1 * humidityScore),
    0,
    100
  );
}

/**
 * @param {object} params
 * @param {object} params.ballpark
 * @param {object|null} params.forecastHour
 * @param {RoofState} [params.roofState]
 */
export function computeOffensiveEnvironmentScores({ ballpark, forecastHour, roofState: roofStateIn }) {
  const roofState = roofStateIn || resolveRoofState(ballpark);
  const neutralWeather = isWeatherNeutralized(roofState, ballpark);

  const cfBearing = Number(ballpark.centerFieldBearingDegrees);
  const lfBearing = Number.isFinite(cfBearing) ? (cfBearing + 45) % 360 : null;
  const rfBearing = Number.isFinite(cfBearing) ? (cfBearing + 315) % 360 : null;

  const windDir = forecastHour?.windDirectionDegrees;
  const windSpeed = forecastHour?.windSpeedKmh;

  let windOutToCenterScore = 0;
  let windOutToLeftScore = 0;
  let windOutToRightScore = 0;

  if (!neutralWeather) {
    if (Number.isFinite(cfBearing)) {
      windOutToCenterScore = windOutScore(windDir, cfBearing, windSpeed);
    }
    if (Number.isFinite(lfBearing)) {
      windOutToLeftScore = windOutScore(windDir, lfBearing, windSpeed);
    }
    if (Number.isFinite(rfBearing)) {
      windOutToRightScore = windOutScore(windDir, rfBearing, windSpeed);
    }
  }

  const windScore = neutralWeather ? 50 : windScoreNormalized(windOutToCenterScore);
  const parkOffenseScore = computeParkOffenseScore(ballpark);
  const temperatureScore = neutralWeather ? 50 : computeTemperatureScore(forecastHour?.temperatureCelsius);
  const humidityScore = neutralWeather ? 50 : computeHumidityScore(forecastHour?.humidityPercent);
  const specialContextScore = computeSpecialContextScore(ballpark, roofState);

  const weatherOffenseScore = computeWeatherOffenseScore({
    windScore,
    temperatureScore,
    humidityScore,
  });

  const offensiveEnvironmentScore = clamp(
    Math.round(
      0.6 * parkOffenseScore + 0.3 * weatherOffenseScore + 0.1 * specialContextScore
    ),
    0,
    100
  );

  const offensiveEnvironmentLabel = scoreToLabel(offensiveEnvironmentScore);

  const explanations = buildExplanations({
    ballpark,
    forecastHour,
    roofState,
    neutralWeather,
    windOutToCenterScore,
    windSpeed,
    parkOffenseScore,
    offensiveEnvironmentScore,
    offensiveEnvironmentLabel,
  });

  const offensiveEnvironment = buildOffensiveEnvironmentBlock({
    offensiveEnvironmentScore,
    offensiveEnvironmentLabel,
    parkOffenseScore,
    weatherOffenseScore,
    specialContextScore,
    explanationFr: explanations.fr,
    explanationEn: explanations.en,
    temperatureScore,
    temperatureCelsius: forecastHour?.temperatureCelsius ?? null,
    windSpeedKmh: Number.isFinite(Number(windSpeed)) ? windSpeed : forecastHour?.windSpeedKmh ?? null,
    windDirectionText: windDirectionText(forecastHour?.windDirectionDegrees),
    ballparkName: ballpark.name || ballpark.shortName || null,
    roofState,
    weatherNeutralized: neutralWeather,
    parkFactorHomeRuns: ballpark.parkFactorHomeRuns ?? null,
    altitudeMeters: ballpark.altitudeMeters ?? null,
  });

  return {
    roofState,
    centerFieldBearingDegrees: Number.isFinite(cfBearing) ? cfBearing : null,
    windOutToCenterScore: Math.round(windOutToCenterScore),
    windOutToLeftScore: Math.round(windOutToLeftScore),
    windOutToRightScore: Math.round(windOutToRightScore),
    parkOffenseScore,
    weatherOffenseScore,
    specialContextScore,
    offensiveEnvironmentScore,
    offensiveEnvironmentLabel,
    offensiveEnvironment,
    explanationFr: explanations.fr,
    explanationEn: explanations.en,
  };
}

/**
 * Seuils : 0-39 défavorable · 40-54 neutre · 55-69 favorable · 70-100 très favorable
 * @returns {OffensiveEnvironmentLabel}
 */
export function scoreToLabel(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "neutral";
  if (s >= 70) return "very_favorable";
  if (s >= 55) return "favorable";
  if (s >= 40) return "neutral";
  return "unfavorable";
}

/** Score combiné parc + température pour la vue Indicateurs Nova. */
function toFiniteScore(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function computeParkTempContextScore(parkScore, temperatureScore, weatherNeutralized = false) {
  const park = toFiniteScore(parkScore);
  const temp = weatherNeutralized ? toFiniteScore(50) : toFiniteScore(temperatureScore);
  if (park == null && temp == null) return null;
  if (park == null) return temp;
  if (temp == null) return park;
  return Math.round(0.65 * park + 0.35 * temp);
}

/** Bloc prêt pour Nova Coach / client. */
export function buildOffensiveEnvironmentBlock({
  offensiveEnvironmentScore,
  offensiveEnvironmentLabel,
  parkOffenseScore,
  weatherOffenseScore,
  specialContextScore,
  explanationFr,
  explanationEn,
  temperatureScore = null,
  temperatureCelsius = null,
  windSpeedKmh = null,
  windDirectionText: windDirText = null,
  ballparkName = null,
  roofState = null,
  weatherNeutralized = false,
  parkFactorHomeRuns = null,
  altitudeMeters = null,
}) {
  const score = Number(offensiveEnvironmentScore);
  const parkScore = parkOffenseScore ?? null;
  const contextScore = computeParkTempContextScore(
    parkScore,
    temperatureScore,
    weatherNeutralized
  );

  return {
    score: Number.isFinite(score) ? score : null,
    label: offensiveEnvironmentLabel || scoreToLabel(score),
    parkScore,
    weatherScore: weatherOffenseScore ?? null,
    specialScore: specialContextScore ?? null,
    contextScore,
    contextLabel: contextScore != null ? scoreToLabel(contextScore) : null,
    temperatureScore: temperatureScore ?? null,
    temperatureCelsius: Number.isFinite(Number(temperatureCelsius))
      ? Math.round(Number(temperatureCelsius))
      : null,
    windSpeedKmh: Number.isFinite(Number(windSpeedKmh)) ? Math.round(Number(windSpeedKmh)) : null,
    windDirectionText: windDirText || null,
    ballparkName: ballparkName || null,
    roofState: roofState || null,
    weatherNeutralized: weatherNeutralized === true,
    parkFactorHomeRuns: parkFactorHomeRuns ?? null,
    altitudeMeters: altitudeMeters ?? null,
    explanationFr: explanationFr || "",
    explanationEn: explanationEn || "",
  };
}

/** @deprecated Utiliser scoreToLabel */
export function scoreToTier(score) {
  const label = scoreToLabel(score);
  return label === "unfavorable" ? "low" : label;
}

function buildExplanations(ctx) {
  const {
    ballpark,
    forecastHour,
    roofState,
    neutralWeather,
    windOutToCenterScore,
    windSpeed,
    parkOffenseScore,
    offensiveEnvironmentScore,
    offensiveEnvironmentLabel,
  } = ctx;

  const tierFr = labelLabelFr(offensiveEnvironmentLabel);
  const tierEn = labelLabelEn(offensiveEnvironmentLabel);
  const parkName = ballpark.name || "ce stade";
  const temp = forecastHour?.temperatureCelsius;
  const wind = windSpeed ?? forecastHour?.windSpeedKmh;
  const windText = windDirectionText(forecastHour?.windDirectionDegrees);

  const parkHintFr =
    parkOffenseScore >= 62
      ? `parc très favorable à l'attaque (${parkName})`
      : parkOffenseScore >= 52
      ? `parc favorable à l'attaque (${parkName})`
      : parkOffenseScore <= 38
      ? `parc plutôt favorable aux lanceurs (${parkName})`
      : `parc neutre (${parkName})`;

  const parkHintEn =
    parkOffenseScore >= 62
      ? `very hitter-friendly park (${parkName})`
      : parkOffenseScore >= 52
      ? `hitter-friendly park (${parkName})`
      : parkOffenseScore <= 38
      ? `pitcher-friendly park (${parkName})`
      : `neutral park (${parkName})`;

  let weatherFr = "";
  let weatherEn = "";

  if (neutralWeather) {
    weatherFr = "toit fermé — impact météo réduit";
    weatherEn = "roof closed — reduced weather impact";
  } else if (Number.isFinite(temp) && Number.isFinite(wind)) {
    const lightWind = wind < 12;
    const strongWind = wind >= 20;
    const windOut = !lightWind && windOutToCenterScore > 12;
    const windIn = !lightWind && windOutToCenterScore < -12;

    if (lightWind) {
      weatherFr = `${Math.round(temp)}°C, vent léger ${Math.round(wind)} km/h${windText ? ` (${windText})` : ""}`;
      weatherEn = `${Math.round(temp)}°C, light ${Math.round(wind)} km/h wind${windText ? ` (${windText})` : ""}`;
    } else if (windOut) {
      weatherFr = `${Math.round(temp)}°C, vent ${strongWind ? "fort " : ""}${Math.round(wind)} km/h sortant${windText ? ` (${windText})` : ""}`;
      weatherEn = `${Math.round(temp)}°C, ${strongWind ? "strong " : ""}${Math.round(wind)} km/h wind blowing out${windText ? ` (${windText})` : ""}`;
    } else if (windIn) {
      weatherFr = `${Math.round(temp)}°C, vent ${strongWind ? "fort " : ""}${Math.round(wind)} km/h entrant${windText ? ` (${windText})` : ""}`;
      weatherEn = `${Math.round(temp)}°C, ${strongWind ? "strong " : ""}${Math.round(wind)} km/h wind blowing in${windText ? ` (${windText})` : ""}`;
    } else {
      weatherFr = `${Math.round(temp)}°C, vent ${Math.round(wind)} km/h${windText ? ` (${windText})` : ""}`;
      weatherEn = `${Math.round(temp)}°C, ${Math.round(wind)} km/h wind${windText ? ` (${windText})` : ""}`;
    }
  } else {
    weatherFr = "conditions météo partiellement disponibles";
    weatherEn = "weather data partially available";
  }

  return {
    fr: `Environnement offensif ${tierFr} (score ${offensiveEnvironmentScore}/100) : ${parkHintFr}, ${weatherFr}${roofState === "unknown" && ballpark.roofType === "retractable" ? ", toit rétractable (état inconnu)" : ""}.`,
    en: `${capitalize(tierEn)} offensive environment (score ${offensiveEnvironmentScore}/100): ${parkHintEn}, ${weatherEn}${roofState === "unknown" && ballpark.roofType === "retractable" ? ", retractable roof (state unknown)" : ""}.`,
  };
}

function labelLabelFr(label) {
  if (label === "very_favorable") return "très favorable";
  if (label === "favorable") return "favorable";
  if (label === "unfavorable") return "défavorable";
  return "neutre";
}

function labelLabelEn(label) {
  if (label === "very_favorable") return "very favorable";
  if (label === "favorable") return "favorable";
  if (label === "unfavorable") return "unfavorable";
  return "neutral";
}

function capitalize(s) {
  const t = String(s || "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function validateWeatherValues(row = {}) {
  const temp = row.temperatureCelsius;
  const humidity = row.humidityPercent;
  const wind = row.windSpeedKmh;
  const gust = row.windGustKmh;

  if (temp != null && (!Number.isFinite(Number(temp)) || temp < -30 || temp > 50)) {
    return false;
  }
  if (humidity != null && (!Number.isFinite(Number(humidity)) || humidity < 0 || humidity > 100)) {
    return false;
  }
  if (wind != null && (!Number.isFinite(Number(wind)) || wind < 0 || wind > 150)) {
    return false;
  }
  if (gust != null && (!Number.isFinite(Number(gust)) || gust < 0 || gust > 180)) {
    return false;
  }
  return true;
}

export function sanitizeWeatherRow(hour = {}) {
  return {
    temperatureCelsius: finiteOrNull(hour.temperatureCelsius),
    humidityPercent: finiteOrNull(hour.humidityPercent),
    precipitationProbability: finiteOrNull(hour.precipitationProbability),
    windSpeedKmh: finiteOrNull(hour.windSpeedKmh),
    windGustKmh: finiteOrNull(hour.windGustKmh),
    windDirectionDegrees: finiteOrNull(hour.windDirectionDegrees),
    weatherCode: finiteOrNull(hour.weatherCode),
    forecastHourLocal: hour.time ? String(hour.time) : null,
  };
}

function finiteOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
