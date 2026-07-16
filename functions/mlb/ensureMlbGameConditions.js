/**
 * ensureMlbGameConditionsForDate — conditions offensives par match (idempotent).
 *
 * Lit mlb_schedule_daily, résout catalog_ballparks, appelle Open-Meteo,
 * écrit mlb_game_conditions/{gamePk}.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger, readTS } from "../utils.js";
import { appYmd } from "../ProphetikDate.js";
import { FUNCTIONS_REGION } from "../regions.js";
import { ballparkIdFromVenueId } from "./ballparkCatalogData.js";
import { resolveBallparkForVenue, loadAllBallparksMap } from "./ballparkCatalog.js";
import {
  fetchOpenMeteoHourlyForecast,
  pickClosestForecastHour,
  windDirectionText,
} from "./openMeteoClient.js";
import {
  computeOffensiveEnvironmentScores,
  sanitizeWeatherRow,
  validateWeatherValues,
  buildOffensiveEnvironmentBlock,
} from "./gameConditionsScoring.js";

export const FORECAST_TTL_MS = 6 * 60 * 60 * 1000;
const COLLECTION = "mlb_game_conditions";

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

function toDateOrNull(v) {
  return readTS(v);
}

function isGameFinal(game = {}) {
  const state = String(game?.status?.abstractGameState || "").toLowerCase();
  return state === "final";
}

function shouldSkipRefresh(existing, game, nowMs, force = false) {
  if (force) return false;
  if (!existing?.exists) return false;
  if (isGameFinal(game)) return true;

  const data = existing.data() || {};
  const retrievedAt = toDateOrNull(data.forecastRetrievedAt);
  if (!retrievedAt) return false;

  return nowMs - retrievedAt.getTime() < FORECAST_TTL_MS;
}

async function loadScheduleGames(gameDateYmd) {
  const dayId = ymdCompact(gameDateYmd);
  const snap = await db.collection(`mlb_schedule_daily/${dayId}/games`).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

function buildMissingBallparkDoc({ game, gameDateYmd, venueId, now }) {
  const gamePk = String(game.gamePk || game.id || "").trim();
  return {
    sport: "MLB",
    gamePk,
    gameDate: gameDateYmd,
    gameTimeLocal: null,
    venueId: venueId ?? null,
    ballparkId: venueId != null ? ballparkIdFromVenueId(venueId) : null,
    homeTeamId: Number(game?.homeTeam?.id) || null,
    awayTeamId: Number(game?.awayTeam?.id) || null,
    status: "missing_ballpark_catalog",
    offensiveEnvironmentLabel: "neutral",
    offensiveEnvironmentScore: null,
    parkOffenseScore: null,
    weatherOffenseScore: null,
    specialContextScore: null,
    offensiveEnvironment: buildOffensiveEnvironmentBlock({
      offensiveEnvironmentScore: null,
      offensiveEnvironmentLabel: "neutral",
      parkOffenseScore: null,
      weatherOffenseScore: null,
      specialContextScore: null,
      explanationFr: `Stade non répertorié (venueId=${venueId ?? "?"}). Conditions offensives indisponibles.`,
      explanationEn: `Ballpark not in catalog (venueId=${venueId ?? "?"}). Offensive conditions unavailable.`,
    }),
    explanationFr: `Stade non répertorié (venueId=${venueId ?? "?"}). Conditions offensives indisponibles.`,
    explanationEn: `Ballpark not in catalog (venueId=${venueId ?? "?"}). Offensive conditions unavailable.`,
    forecastProvider: "open-meteo",
    forecastRetrievedAt: now,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };
}

function buildForecastErrorDoc({ game, gameDateYmd, ballpark, venueId, errMsg, now }) {
  const gamePk = String(game.gamePk || game.id || "").trim();
  return {
    sport: "MLB",
    gamePk,
    gameDate: gameDateYmd,
    venueId: venueId ?? null,
    ballparkId: ballpark?.id || ballparkIdFromVenueId(venueId),
    homeTeamId: Number(game?.homeTeam?.id) || null,
    awayTeamId: Number(game?.awayTeam?.id) || null,
    status: "forecast_error",
    offensiveEnvironmentLabel: "neutral",
    offensiveEnvironmentScore: null,
    offensiveEnvironment: buildOffensiveEnvironmentBlock({
      offensiveEnvironmentScore: null,
      offensiveEnvironmentLabel: "neutral",
      parkOffenseScore: null,
      weatherOffenseScore: null,
      specialContextScore: null,
      explanationFr: `Erreur météo : ${errMsg}`,
      explanationEn: `Weather error: ${errMsg}`,
    }),
    explanationFr: `Erreur météo : ${errMsg}`,
    explanationEn: `Weather error: ${errMsg}`,
    forecastProvider: "open-meteo",
    forecastRetrievedAt: now,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * @param {object} params
 * @param {object} params.game
 * @param {string} params.gameDateYmd
 * @param {Map<string, object>} [params.ballparksMap]
 * @param {boolean} [params.force]
 */
export async function ensureMlbGameConditionsForGame({
  game,
  gameDateYmd,
  ballparksMap = null,
  force = false,
}) {
  const gamePk = String(game?.gamePk || game?.id || "").trim();
  if (!gamePk) {
    return { ok: false, reason: "missing_gamePk", gamePk: null };
  }

  const ref = db.doc(`${COLLECTION}/${gamePk}`);
  const existing = await ref.get();
  const nowMs = Date.now();
  const now = new Date(nowMs);

  if (shouldSkipRefresh(existing, game, nowMs, force)) {
    return { ok: true, skipped: true, gamePk, reason: "fresh_or_final" };
  }

  const venueId = Number(game?.venue?.id);
  if (!Number.isFinite(venueId)) {
    logger.warn("[ensureMlbGameConditions] missing venue.id", { gamePk, gameDateYmd });
    await ref.set(
      {
        ...buildMissingBallparkDoc({ game, gameDateYmd, venueId: null, now }),
        status: "missing_schedule",
      },
      { merge: true }
    );
    return { ok: false, reason: "missing_venue", gamePk };
  }

  let ballpark = ballparksMap?.get(String(venueId)) || null;
  if (!ballpark) {
    ballpark = await resolveBallparkForVenue(venueId);
  }

  if (!ballpark) {
    logger.warn("[ensureMlbGameConditions] unknown ballpark", { gamePk, venueId, gameDateYmd });
    await ref.set(buildMissingBallparkDoc({ game, gameDateYmd, venueId, now }), { merge: true });
    return { ok: false, reason: "missing_ballpark_catalog", gamePk, venueId };
  }

  const pitchUtc = toDateOrNull(game.startTimeUTC);
  const timezone = ballpark.timezone || "America/New_York";

  let forecastHour = null;
  try {
    const hours = await fetchOpenMeteoHourlyForecast({
      latitude: ballpark.latitude,
      longitude: ballpark.longitude,
      timezone,
      forecastDays: 2,
    });
    forecastHour = pickClosestForecastHour(hours, pitchUtc, timezone);
  } catch (e) {
    const errMsg = String(e?.message || e);
    logger.error("[ensureMlbGameConditions] open-meteo failed", { gamePk, venueId, errMsg });
    await ref.set(
      buildForecastErrorDoc({ game, gameDateYmd, ballpark, venueId, errMsg, now }),
      { merge: true }
    );
    return { ok: false, reason: "forecast_error", gamePk, errMsg };
  }

  const weather = sanitizeWeatherRow(forecastHour || {});
  if (!validateWeatherValues(weather)) {
    logger.warn("[ensureMlbGameConditions] invalid weather values", { gamePk, weather });
  }

  const scores = computeOffensiveEnvironmentScores({
    ballpark,
    forecastHour: forecastHour || {},
  });

  const gameTimeLocal = pitchUtc
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(pitchUtc)
    : null;

  const payload = {
    sport: "MLB",
    gamePk,
    gameDate: gameDateYmd,
    gameTimeLocal,
    venueId,
    ballparkId: ballpark.id || ballparkIdFromVenueId(venueId),
    homeTeamId: Number(game?.homeTeam?.id) || null,
    awayTeamId: Number(game?.awayTeam?.id) || null,

    ...weather,
    windDirectionText: windDirectionText(weather.windDirectionDegrees),

    roofState: scores.roofState,
    centerFieldBearingDegrees: scores.centerFieldBearingDegrees,
    windOutToCenterScore: scores.windOutToCenterScore,
    windOutToLeftScore: scores.windOutToLeftScore,
    windOutToRightScore: scores.windOutToRightScore,
    parkOffenseScore: scores.parkOffenseScore,
    weatherOffenseScore: scores.weatherOffenseScore,
    specialContextScore: scores.specialContextScore,
    offensiveEnvironmentScore: scores.offensiveEnvironmentScore,
    offensiveEnvironmentLabel: scores.offensiveEnvironmentLabel,
    offensiveEnvironment: scores.offensiveEnvironment,
    explanationFr: scores.explanationFr,
    explanationEn: scores.explanationEn,

    status: "ready",
    forecastProvider: "open-meteo",
    forecastRetrievedAt: now,
    updatedAt: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  };

  await ref.set(payload, { merge: true });

  logger.info("[ensureMlbGameConditions] written", {
    gamePk,
    gameDateYmd,
    offensiveEnvironmentLabel: scores.offensiveEnvironmentLabel,
    offensiveEnvironmentScore: scores.offensiveEnvironmentScore,
  });

  return {
    ok: true,
    written: true,
    gamePk,
    offensiveEnvironmentLabel: scores.offensiveEnvironmentLabel,
    offensiveEnvironmentScore: scores.offensiveEnvironmentScore,
    offensiveEnvironment: scores.offensiveEnvironment,
  };
}

/**
 * @param {string} gameDateYmd YYYY-MM-DD
 * @param {{ force?: boolean, dryRun?: boolean }} [options]
 */
export async function ensureMlbGameConditionsForDate(gameDateYmd, options = {}) {
  const ymd = String(gameDateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("INVALID_GAME_DATE_YMD");
  }

  const force = options.force === true;
  const dryRun = options.dryRun === true;

  const games = await loadScheduleGames(ymd);
  const ballparksMap = await loadAllBallparksMap();

  const results = {
    ok: true,
    gameDateYmd: ymd,
    dryRun,
    gameCount: games.length,
    written: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  for (const game of games) {
    if (dryRun) {
      results.details.push({
        gamePk: String(game.gamePk || game.id),
        venueId: game?.venue?.id ?? null,
        dryRun: true,
      });
      continue;
    }

    try {
      const row = await ensureMlbGameConditionsForGame({
        game,
        gameDateYmd: ymd,
        ballparksMap,
        force,
      });

      results.details.push(row);
      if (row.skipped) results.skipped += 1;
      else if (row.written) results.written += 1;
      else if (!row.ok) results.errors += 1;
    } catch (e) {
      results.errors += 1;
      results.details.push({
        gamePk: String(game.gamePk || game.id),
        ok: false,
        err: String(e?.message || e),
      });
      logger.error("[ensureMlbGameConditionsForDate] game failed", {
        gamePk: game.gamePk,
        err: String(e?.message || e),
      });
    }
  }

  logger.info("[ensureMlbGameConditionsForDate] done", {
    gameDateYmd: ymd,
    gameCount: games.length,
    written: results.written,
    skipped: results.skipped,
    errors: results.errors,
  });

  return results;
}

/** Cron — 5h20 Toronto, avant autopilot 6h30. */
export const cronEnsureMlbGameConditions = onSchedule(
  {
    schedule: "20 5 * * *",
    timeZone: "America/Toronto",
    region: FUNCTIONS_REGION,
    timeoutSeconds: 540,
  },
  async () => {
    const gameDateYmd = appYmd(new Date());
    await ensureMlbGameConditionsForDate(gameDateYmd);
  }
);

/** Callable — backfill / debug manuel. */
export const ensureMlbGameConditionsNow = onCall(
  { region: FUNCTIONS_REGION, timeoutSeconds: 540 },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    try {
      const gameDateYmd = String(req.data?.gameDateYmd || appYmd(new Date())).trim();
      const force = req.data?.force === true;
      const dryRun = req.data?.dryRun === true;

      const result = await ensureMlbGameConditionsForDate(gameDateYmd, { force, dryRun });
      return { ok: true, ...result };
    } catch (e) {
      logger.error("[ensureMlbGameConditionsNow]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);
