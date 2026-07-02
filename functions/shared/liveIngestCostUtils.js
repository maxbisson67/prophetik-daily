/**
 * Helpers partagés NHL/MLB pour réduire les writes Firestore inutiles.
 */

export function shallowFieldsEqual(a = {}, b = {}, keys = []) {
  for (const key of keys) {
    if (a?.[key] !== b?.[key]) return false;
  }
  return true;
}

/** Fenêtre avant le début du match où on commence à poller (ms). */
export const LIVE_PREGAME_WINDOW_MS = 90 * 60 * 1000;

/** Après un final, combien de temps on continue à poller (ms). */
export const LIVE_POST_FINAL_WINDOW_MS = 4 * 60 * 60 * 1000;

export function parseStartMs(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return Number.isFinite(d?.getTime?.()) ? d.getTime() : null;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

export function isWithinPregameWindow(startMs, nowMs = Date.now()) {
  if (!startMs) return false;
  return nowMs >= startMs - LIVE_PREGAME_WINDOW_MS && nowMs < startMs;
}

export function isRecentlyFinal(finalizedAtMs, nowMs = Date.now()) {
  if (!finalizedAtMs) return true;
  return nowMs - finalizedAtMs <= LIVE_POST_FINAL_WINDOW_MS;
}
