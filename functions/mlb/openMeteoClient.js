/**
 * Client Open-Meteo — prévisions horaires (serveur uniquement).
 * https://open-meteo.com/en/docs
 */
import { UA_HEADERS } from "../utils.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

async function httpFetch(url, options) {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch(url, options);
  }
  const { default: nodeFetch } = await import("node-fetch");
  return nodeFetch(url, options);
}

/**
 * @typedef {Object} OpenMeteoHourly
 * @property {string} time ISO local
 * @property {number|null} temperatureCelsius
 * @property {number|null} humidityPercent
 * @property {number|null} precipitationProbability
 * @property {number|null} windSpeedKmh
 * @property {number|null} windGustKmh
 * @property {number|null} windDirectionDegrees
 * @property {number|null} weatherCode
 */

/**
 * @param {{ latitude: number, longitude: number, timezone?: string, forecastDays?: number }} params
 * @returns {Promise<OpenMeteoHourly[]>}
 */
export async function fetchOpenMeteoHourlyForecast({
  latitude,
  longitude,
  timezone = "America/New_York",
  forecastDays = 2,
}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("OPEN_METEO_INVALID_COORDS");
  }

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("forecast_days", String(Math.min(Math.max(forecastDays, 1), 7)));
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "weather_code",
    ].join(",")
  );
  url.searchParams.set("wind_speed_unit", "kmh");

  const res = await httpFetch(url.toString(), { headers: UA_HEADERS });
  if (!res.ok) {
    throw new Error(`OPEN_METEO_HTTP_${res.status}`);
  }

  const json = await res.json();
  const hourly = json?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];

  return times.map((time, idx) => ({
    time: String(time),
    temperatureCelsius: numOrNull(hourly.temperature_2m?.[idx]),
    humidityPercent: numOrNull(hourly.relative_humidity_2m?.[idx]),
    precipitationProbability: numOrNull(hourly.precipitation_probability?.[idx]),
    windSpeedKmh: numOrNull(hourly.wind_speed_10m?.[idx]),
    windGustKmh: numOrNull(hourly.wind_gusts_10m?.[idx]),
    windDirectionDegrees: numOrNull(hourly.wind_direction_10m?.[idx]),
    weatherCode: numOrNull(hourly.weather_code?.[idx]),
  }));
}

/**
 * Sélectionne l'heure horaire la plus proche du first pitch.
 * @param {OpenMeteoHourly[]} hours
 * @param {Date|null} pitchUtc
 * @param {string} timezone
 */
export function pickClosestForecastHour(hours, pitchUtc, timezone = "America/New_York") {
  if (!Array.isArray(hours) || !hours.length) return null;

  const pitchMs = pitchUtc?.getTime?.();
  if (!Number.isFinite(pitchMs)) {
    return hours[0];
  }

  const pitchLocalKey = formatLocalHourKey(pitchUtc, timezone);

  let best = hours[0];
  let bestDelta = Infinity;

  for (const row of hours) {
    const rowMs = parseLocalHourToUtcMs(row.time, timezone);
    if (!Number.isFinite(rowMs)) continue;
    const delta = Math.abs(rowMs - pitchMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = row;
    }
    if (row.time === pitchLocalKey) {
      return row;
    }
  }

  return best;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatLocalHourKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hour = String(get("hour")).padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:00`;
}

function parseLocalHourToUtcMs(localHourKey, timeZone) {
  const m = String(localHourKey || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/);
  if (!m) return NaN;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);

  // Approximation : itérer autour du midi UTC pour trouver l'instant local
  const guess = new Date(Date.UTC(y, mo - 1, d, h + 5, 0, 0));
  for (let offset = -14; offset <= 14; offset += 1) {
    const candidate = new Date(guess.getTime() + offset * 3600 * 1000);
    if (formatLocalHourKey(candidate, timeZone) === `${m[1]}-${m[2]}-${m[3]}T${String(h).padStart(2, "0")}:00`) {
      return candidate.getTime();
    }
  }

  return guess.getTime();
}

/** Convertit degrés vent en rose des vents abrégée (ex. SSO). */
export function windDirectionText(degrees) {
  const n = Number(degrees);
  if (!Number.isFinite(n)) return null;
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const idx = Math.round(((n % 360) + 360) % 360 / 22.5) % 16;
  return dirs[idx];
}
