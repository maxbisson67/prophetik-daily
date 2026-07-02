/**
 * L1 — Contrôle adaptatif ingest live NHL/MLB.
 * Doc Firestore: live_control/{league}_{ymdCompact}
 */

import { db, FieldValue, logger } from "../utils.js";
import {
  isRecentlyFinal,
  isWithinPregameWindow,
  parseStartMs,
} from "./liveIngestCostUtils.js";

export const LIVE_LEAGUES = {
  NHL: "nhl",
  MLB: "mlb",
};

export const LIVE_MODES = {
  IDLE: "idle",
  PREGAME: "pregame",
  LIVE: "live",
  WINDDOWN: "winddown",
};

/** Intervalle minimum entre deux ingests lourds (ms). */
export function heavyIngestIntervalMs(mode) {
  switch (mode) {
    case LIVE_MODES.LIVE:
      return 60 * 1000;
    case LIVE_MODES.PREGAME:
    case LIVE_MODES.WINDDOWN:
      return 5 * 60 * 1000;
    case LIVE_MODES.IDLE:
    default:
      return Infinity;
  }
}

/** Re-vérifier le mode même en idle (détecter pregame approchant). */
export const MODE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function liveControlDocId(league, ymd) {
  const compact = String(ymd || "").replaceAll("-", "");
  return `${String(league || "").toLowerCase()}_${compact}`;
}

export function liveBoardCollection(league) {
  return String(league || "").toLowerCase() === LIVE_LEAGUES.MLB
    ? "live_board_mlb"
    : "live_board_nhl";
}

function tsToMillis(v) {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

export async function readLiveControl(league, ymd) {
  const id = liveControlDocId(league, ymd);
  const snap = await db.collection("live_control").doc(id).get();
  return snap.exists ? snap.data() || {} : null;
}

export async function writeLiveControl(league, ymd, patch = {}) {
  const id = liveControlDocId(league, ymd);
  await db.collection("live_control").doc(id).set(
    {
      league: String(league || "").toLowerCase(),
      ymd,
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export function shouldRunHeavyIngest({ mode, lastHeavyRunAt, nowMs = Date.now(), forceRun = false }) {
  if (forceRun) return true;
  if (!mode || mode === LIVE_MODES.IDLE) return false;

  const last = tsToMillis(lastHeavyRunAt);
  if (!last) return true;

  return nowMs - last >= heavyIngestIntervalMs(mode);
}

export function shouldRefreshModeCheck({ control, nowMs = Date.now(), forceRun = false }) {
  if (forceRun) return true;
  const last = tsToMillis(control?.lastModeCheckAt);
  if (!last) return true;
  if (control?.mode && control.mode !== LIVE_MODES.IDLE) return true;
  return nowMs - last >= MODE_CHECK_INTERVAL_MS;
}

function nhlGameState(g = {}) {
  return String(g.gameState || g.gameScheduleState || "").toUpperCase();
}

function mlbAbstractState(g = {}) {
  return String(g?.status?.abstractGameState || "").toLowerCase();
}

/**
 * Mode journée NHL à partir du schedule API (sans lire Firestore par match).
 */
export function computeNhlDayMode(games = [], nowMs = Date.now()) {
  if (!Array.isArray(games) || !games.length) return LIVE_MODES.IDLE;

  let hasLive = false;
  let hasPregame = false;
  let hasWinddown = false;

  for (const g of games) {
    const state = nhlGameState(g);
    if (["LIVE", "CRIT", "STARTED"].includes(state)) {
      hasLive = true;
      break;
    }
  }

  if (hasLive) return LIVE_MODES.LIVE;

  for (const g of games) {
    const state = nhlGameState(g);
    if (["FINAL", "OFF"].includes(state)) {
      hasWinddown = true;
      continue;
    }

    const startMs = parseStartMs(g.startTimeUTC || g.startTimeUtc);
    if (isWithinPregameWindow(startMs, nowMs)) {
      hasPregame = true;
      continue;
    }
    if (startMs && nowMs >= startMs && nowMs <= startMs + 30 * 60 * 1000) {
      hasPregame = true;
    }
  }

  if (hasPregame) return LIVE_MODES.PREGAME;
  if (hasWinddown) return LIVE_MODES.WINDDOWN;
  return LIVE_MODES.IDLE;
}

/**
 * Mode journée MLB à partir du calendrier Firestore.
 */
export function computeMlbDayMode(scheduleGames = [], nowMs = Date.now()) {
  if (!Array.isArray(scheduleGames) || !scheduleGames.length) return LIVE_MODES.IDLE;

  let hasLive = false;
  let hasPregame = false;
  let hasWinddown = false;

  for (const g of scheduleGames) {
    const abstract = mlbAbstractState(g);
    if (abstract === "live") {
      hasLive = true;
      break;
    }
  }

  if (hasLive) return LIVE_MODES.LIVE;

  for (const g of scheduleGames) {
    const abstract = mlbAbstractState(g);
    if (abstract === "final") {
      hasWinddown = true;
      continue;
    }

    const raw = g?.startTimeUTC || g?.gameDateRaw;
    const startMs = parseStartMs(raw);
    if (isWithinPregameWindow(startMs, nowMs)) {
      hasPregame = true;
      continue;
    }
    if (startMs && nowMs >= startMs && nowMs <= startMs + 30 * 60 * 1000) {
      hasPregame = true;
    }
  }

  if (hasPregame) return LIVE_MODES.PREGAME;
  if (hasWinddown) return LIVE_MODES.WINDDOWN;
  return LIVE_MODES.IDLE;
}

/** Affiner le mode winddown si tous les finaux sont anciens (> 4 h). */
export function refineWinddownMode(mode, existingFinalizedAts = [], nowMs = Date.now()) {
  if (mode !== LIVE_MODES.WINDDOWN) return mode;
  if (!existingFinalizedAts.length) return mode;

  const anyRecent = existingFinalizedAts.some((t) => isRecentlyFinal(Number(t || 0), nowMs));
  return anyRecent ? LIVE_MODES.WINDDOWN : LIVE_MODES.IDLE;
}

export function logLiveControlDecision(league, ymd, payload) {
  logger.info(`[liveControl:${league}]`, { ymd, ...payload });
}
