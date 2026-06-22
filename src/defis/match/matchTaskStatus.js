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

function buildMatchTaskResult(state) {
  return { state };
}

/** Statut sportif d'un slot TP : tout l'avant-match (open + locked) → non débuté. */
export function resolveTpSlotMatchStatus(slot, options = {}) {
  if (isMlbGamePostponed(options?.scheduleStatus)) {
    return buildMatchTaskResult(MATCH_TASK_STATES.POSTPONED);
  }

  const st = normalizeStatus(slot?.status || "open");

  if (st === "decided" || st === "closed") {
    return buildMatchTaskResult(MATCH_TASK_STATES.COMPLETED);
  }

  if (st === "live" || st === "pending") {
    return buildMatchTaskResult(MATCH_TASK_STATES.IN_PROGRESS);
  }

  return buildMatchTaskResult(MATCH_TASK_STATES.NOT_STARTED);
}

/** Statut sportif d'un défi FGC (match unique). */
export function resolveFgcMatchStatus(challenge, options = {}) {
  if (isMlbGamePostponed(options?.scheduleStatus)) {
    return buildMatchTaskResult(MATCH_TASK_STATES.POSTPONED);
  }

  const st = normalizeStatus(challenge?.status ?? options?.status);

  if (["decided", "closed", "completed"].includes(st)) {
    return buildMatchTaskResult(MATCH_TASK_STATES.COMPLETED);
  }

  if (st === "live" || st === "pending") {
    return buildMatchTaskResult(MATCH_TASK_STATES.IN_PROGRESS);
  }

  return buildMatchTaskResult(MATCH_TASK_STATES.NOT_STARTED);
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
