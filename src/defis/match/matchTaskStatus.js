import i18n from "@src/i18n/i18n";
import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";

export const MATCH_TASK_STATES = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  POSTPONED: "postponed",
});

function normalizeStatus(st) {
  return String(st || "").toLowerCase().trim();
}

function toDateAny(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function isGameStartedByTime(startTimeUTC, nowMs = Date.now()) {
  const start = toDateAny(startTimeUTC);
  return !!start && nowMs >= start.getTime();
}

function isScheduleFinal(scheduleStatus) {
  if (!scheduleStatus) return false;
  const abstract = String(scheduleStatus?.abstractGameState || "").toLowerCase();
  if (abstract === "final") return true;
  const state = String(scheduleStatus?.state || scheduleStatus?.gameState || "").toLowerCase();
  return state === "final" || state === "off";
}

function isScheduleLive(scheduleStatus) {
  if (!scheduleStatus) return false;
  const abstract = String(scheduleStatus?.abstractGameState || "").toLowerCase();
  if (abstract === "live") return true;
  if (scheduleStatus?.isLive === true) return true;
  const state = String(scheduleStatus?.state || scheduleStatus?.gameState || "").toLowerCase();
  return state === "live" || state === "crit";
}

function buildMatchTaskResult(state) {
  return { state };
}

function resolveMatchPhaseFromSignals({
  scheduleStatus,
  entityStatus,
  gameStartTimeUTC,
  nowMs = Date.now(),
}) {
  if (isMlbGamePostponed(scheduleStatus)) {
    return MATCH_TASK_STATES.POSTPONED;
  }

  if (isScheduleFinal(scheduleStatus)) {
    return MATCH_TASK_STATES.COMPLETED;
  }

  if (isScheduleLive(scheduleStatus)) {
    return MATCH_TASK_STATES.IN_PROGRESS;
  }

  const st = normalizeStatus(entityStatus || "open");

  if (["decided", "closed", "completed"].includes(st)) {
    return MATCH_TASK_STATES.COMPLETED;
  }

  if (st === "live" || st === "pending") {
    return MATCH_TASK_STATES.IN_PROGRESS;
  }

  if (isGameStartedByTime(gameStartTimeUTC, nowMs)) {
    return MATCH_TASK_STATES.IN_PROGRESS;
  }

  return MATCH_TASK_STATES.NOT_STARTED;
}

/** Statut sportif d'un slot TP : calendrier + heure de début + statut slot. */
export function resolveTpSlotMatchStatus(slot, options = {}) {
  return buildMatchTaskResult(
    resolveMatchPhaseFromSignals({
      scheduleStatus: options?.scheduleStatus,
      entityStatus: slot?.status,
      gameStartTimeUTC: slot?.gameStartTimeUTC ?? options?.gameStartTimeUTC,
      nowMs: options?.nowMs,
    })
  );
}

/** Statut sportif d'un défi FGC (match unique). */
export function resolveFgcMatchStatus(challenge, options = {}) {
  return buildMatchTaskResult(
    resolveMatchPhaseFromSignals({
      scheduleStatus: options?.scheduleStatus,
      entityStatus: challenge?.status ?? options?.status,
      gameStartTimeUTC: challenge?.gameStartTimeUTC ?? options?.gameStartTimeUTC,
      nowMs: options?.nowMs,
    })
  );
}

export function getMatchTaskStatusUi(state) {
  switch (state) {
    case MATCH_TASK_STATES.NOT_STARTED:
      return {
        color: "#2563eb",
        bg: "rgba(37,99,235,0.10)",
        icon: "time-outline",
      };
    case MATCH_TASK_STATES.IN_PROGRESS:
      return {
        color: "#ea580c",
        bg: "rgba(234,88,12,0.10)",
        icon: "timer-outline",
      };
    case MATCH_TASK_STATES.COMPLETED:
      return {
        color: "#6b7280",
        bg: "rgba(107,114,128,0.10)",
        icon: "checkmark-circle",
      };
    case MATCH_TASK_STATES.POSTPONED:
      return {
        color: "#d97706",
        bg: "rgba(217,119,6,0.10)",
        icon: "alert-circle-outline",
      };
    default:
      return {
        color: "#6b7280",
        bg: "rgba(107,114,128,0.10)",
        icon: "help-circle-outline",
      };
  }
}

export function formatMatchTaskLabel(task) {
  const state = task?.state;
  switch (state) {
    case MATCH_TASK_STATES.NOT_STARTED:
      return i18n.t("match.notStarted", { defaultValue: "Non débuté" });
    case MATCH_TASK_STATES.IN_PROGRESS:
      return i18n.t("match.inProgress", { defaultValue: "En cours" });
    case MATCH_TASK_STATES.COMPLETED:
      return i18n.t("match.completed", { defaultValue: "Terminé" });
    case MATCH_TASK_STATES.POSTPONED:
      return i18n.t("match.postponed", { defaultValue: "Reporté" });
    default:
      return i18n.t("match.unknown", { defaultValue: "—" });
  }
}

/** Heure de début TP : optionnellement masquée une fois le match commencé. */
export function shouldShowTpStartTimeLabel(
  startTimeLabel,
  matchTask,
  { hideWhenStarted = false } = {}
) {
  if (!startTimeLabel) return false;
  if (!hideWhenStarted) return true;
  return matchTask?.state === MATCH_TASK_STATES.NOT_STARTED;
}
