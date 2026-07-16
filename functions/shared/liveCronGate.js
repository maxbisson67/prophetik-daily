/**
 * Fenêtre d'exécution des crons live / ingest (America/Toronto).
 * Hors fenêtre : aucune invocation planifiée (schedule Cloud Scheduler).
 * En idle dans la fenêtre : mode check au plus 1×/heure (liveControl).
 */

/** Heures actives Toronto : 11h → 23h, puis 0h → 3h. Off : 4h → 10h59. */
export const LIVE_CRON_ACTIVE_HOURS = {
  morningStart: 11,
  eveningEnd: 23,
  overnightEnd: 3,
};

/** En mode idle, re-vérifier le calendrier au plus 1×/heure (au lieu de 5 min). */
export const IDLE_MODE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function torontoHourFromDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? Number(hourPart.value) : date.getHours();
}

export function isWithinLiveCronScheduleHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return false;
  const { morningStart, eveningEnd, overnightEnd } = LIVE_CRON_ACTIVE_HOURS;
  if (h >= morningStart && h <= eveningEnd) return true;
  if (h >= 0 && h <= overnightEnd) return true;
  return false;
}

export function isWithinLiveCronSchedule(nowMs = Date.now()) {
  return isWithinLiveCronScheduleHour(torontoHourFromDate(new Date(nowMs)));
}

/** Schedule Cloud Scheduler (1 min dans la fenêtre active). Off 4h–10h59 Toronto. */
export const LIVE_CRON_SCHEDULE = "*/1 11-23,0-3 * * *";

/** Inclus : traiter aussi la veille jusqu'à cette heure (winddown). */
export const LIVE_CRON_YESTERDAY_UNTIL_HOUR = LIVE_CRON_ACTIVE_HOURS.overnightEnd + 1;

export function isLeagueModeActive(mode) {
  return !!mode && String(mode).toLowerCase() !== "idle";
}

export function shouldRunIngestForControls({ nhlControl, mlbControl } = {}) {
  if (isLeagueModeActive(nhlControl?.mode)) return true;
  if (isLeagueModeActive(mlbControl?.mode)) return true;
  return false;
}
