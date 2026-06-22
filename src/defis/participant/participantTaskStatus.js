import i18n from "@src/i18n/i18n";
import { lookupPickByGameId } from "@src/defis/tpBundleDisplayHelpers";
import { isSlotLocked } from "@src/defis/tpDeadlineHelpers";
import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";
import {
  isHistoryResultItem,
  resolveChallengeDisplayStatus,
  tpEntryHasParticipation,
} from "@src/defis/results/challengeResultsModel";

export const PARTICIPANT_TASK_STATES = Object.freeze({
  ACTION_REQUIRED: "action_required",
  PARTIAL: "partial",
  DONE_WAITING: "done_waiting",
  CLOSED_JOINED: "closed_joined",
  CLOSED_NOT_JOINED: "closed_not_joined",
});

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function hasCompleteTpPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  const away = pick.predictedAwayScore;
  const home = pick.predictedHomeScore;
  return away != null && home != null && away !== "" && home !== "";
}

function countTpCompletePicks(games = [], picks = {}) {
  let count = 0;
  for (const slot of games) {
    const gameId = String(slot?.gameId || "");
    if (!gameId) continue;
    if (hasCompleteTpPick(lookupPickByGameId(picks, gameId))) count += 1;
  }
  return count;
}

export function isTpSlotActionable(slot, options = {}) {
  const { scheduleStatus, nowMs = Date.now() } = options;
  const st = String(slot?.status || "open").toLowerCase();
  if (st === "decided" || st === "closed") return false;
  if (st !== "open") return false;
  if (isSlotLocked(slot, nowMs, { scheduleStatus })) return false;
  return true;
}

function canActOnFgc(displayStatus) {
  const st = String(displayStatus || "").toLowerCase();
  return st === "open" || st === "postponed";
}

function toDateMs(v) {
  if (!v) return null;
  const d =
    typeof v?.toDate === "function"
      ? v.toDate()
      : v instanceof Date
      ? v
      : new Date(v);
  const ms = d?.getTime?.();
  return Number.isFinite(ms) ? ms : null;
}

function countTsCompletePicks(entry, required) {
  const picks = Array.isArray(entry?.picks) ? entry.picks : [];
  const done = picks.filter((p) => p?.playerId).length;
  return { done, total: required, hasAnyPick: done > 0 };
}

function resolveTsParticipantTaskStatus(item, options = {}) {
  const { isToday = false, nowMs = Date.now() } = options;
  const entry = options.entry ?? options.participation ?? null;
  const required = toNumber(item?.raw?.type ?? item?.type ?? 3, 3);
  const { done, total, hasAnyPick } = countTsCompletePicks(entry, required);

  const uiStatus = String(options.uiStatus || item?.status || "open").toLowerCase();
  const deadlineMs = toDateMs(
    options.signupDeadline ?? item?.signupDeadline ?? item?.raw?.signupDeadline
  );
  const pastDeadline = deadlineMs != null && nowMs >= deadlineMs;
  const canAct = uiStatus === "open" && !pastDeadline;
  const isPast = !isToday || pastDeadline || uiStatus !== "open";

  if (isPast) {
    return buildParticipantTaskResult({
      state: hasAnyPick
        ? PARTICIPANT_TASK_STATES.CLOSED_JOINED
        : PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED,
      done,
      total,
      progressHint: hasAnyPick && done < total,
    });
  }

  if (done === 0) {
    return buildParticipantTaskResult({
      state: PARTICIPANT_TASK_STATES.ACTION_REQUIRED,
      done,
      total,
      ctaKey: "participate",
      showPrimaryCta: true,
    });
  }

  if (done > 0 && done < total) {
    return buildParticipantTaskResult({
      state: PARTICIPANT_TASK_STATES.PARTIAL,
      done,
      total,
      ctaKey: "complete",
      showPrimaryCta: true,
    });
  }

  return buildParticipantTaskResult({
    state: PARTICIPANT_TASK_STATES.DONE_WAITING,
    done,
    total,
    ctaKey: canAct ? "modify" : null,
    showModifyCta: canAct,
    progressHint: total > 0 && done >= total,
  });
}

function buildParticipantTaskResult({
  state,
  done = 0,
  total = 0,
  ctaKey = null,
  showPrimaryCta = false,
  showModifyCta = false,
  progressHint = false,
}) {
  return {
    state,
    progress: { done, total },
    ctaKey,
    showPrimaryCta,
    showModifyCta,
    progressHint,
  };
}

function resolveFgcParticipantTaskStatus(item, options = {}) {
  const { isToday = false, scheduleStatus } = options;
  const entry = options.entry ?? options.participation?.data ?? null;
  const hasPick = !!(
    options.participation?.hasPick ||
    entry?.playerId ||
    options.hasPick
  );

  const displayStatus = resolveChallengeDisplayStatus(item, { scheduleStatus });
  const isPast =
    !isToday || isHistoryResultItem(item, { scheduleStatus }) || !canActOnFgc(displayStatus);

  if (isPast) {
    return buildParticipantTaskResult({
      state: hasPick
        ? PARTICIPANT_TASK_STATES.CLOSED_JOINED
        : PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED,
      ctaKey: null,
    });
  }

  if (!hasPick) {
    return buildParticipantTaskResult({
      state: PARTICIPANT_TASK_STATES.ACTION_REQUIRED,
      ctaKey: "participate",
      showPrimaryCta: true,
    });
  }

  const canModify = canActOnFgc(displayStatus);
  return buildParticipantTaskResult({
    state: PARTICIPANT_TASK_STATES.DONE_WAITING,
    ctaKey: canModify ? "modify" : null,
    showModifyCta: canModify,
  });
}

function resolveTpParticipantTaskStatus(item, options = {}) {
  const { isToday = false, scheduleByGameId = {}, nowMs = Date.now() } = options;
  const entry = options.entry ?? null;
  const bundle = item?.raw || {};
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  const total = games.length;
  const picks = entry?.picks || {};
  const done = countTpCompletePicks(games, picks);
  const hasAnyPick = done > 0 || tpEntryHasParticipation(entry);

  const actionableSlots = games.filter((slot) => {
    const gameId = String(slot?.gameId || "");
    const scheduleStatus = scheduleByGameId?.[gameId]?.status;
    return isTpSlotActionable(slot, { scheduleStatus, nowMs });
  });

  const actionableMissingPick = actionableSlots.filter((slot) => {
    const gameId = String(slot?.gameId || "");
    return !hasCompleteTpPick(lookupPickByGameId(picks, gameId));
  }).length;

  const canModify =
    done > 0 &&
    actionableSlots.some((slot) => {
      const gameId = String(slot?.gameId || "");
      return hasCompleteTpPick(lookupPickByGameId(picks, gameId));
    });

  const isPast = !isToday;

  if (isPast) {
    return buildParticipantTaskResult({
      state: hasAnyPick
        ? PARTICIPANT_TASK_STATES.CLOSED_JOINED
        : PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED,
      done,
      total,
      progressHint: hasAnyPick && done < total,
    });
  }

  if (actionableMissingPick > 0 && done === 0) {
    return buildParticipantTaskResult({
      state: PARTICIPANT_TASK_STATES.ACTION_REQUIRED,
      done,
      total,
      ctaKey: "participate",
      showPrimaryCta: true,
    });
  }

  if (actionableMissingPick > 0 && done > 0) {
    return buildParticipantTaskResult({
      state: PARTICIPANT_TASK_STATES.PARTIAL,
      done,
      total,
      ctaKey: "complete",
      showPrimaryCta: true,
    });
  }

  if (done > 0) {
    return buildParticipantTaskResult({
      state: PARTICIPANT_TASK_STATES.DONE_WAITING,
      done,
      total,
      ctaKey: canModify ? "modify" : null,
      showModifyCta: canModify,
      progressHint: total > 0 && done >= total,
    });
  }

  return buildParticipantTaskResult({
    state: PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED,
    done,
    total,
  });
}

export function resolveParticipantTaskStatus(item, options = {}) {
  if (!item?.kind) {
    return buildParticipantTaskResult({
      state: PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED,
    });
  }

  if (item.kind === "fgc") {
    return resolveFgcParticipantTaskStatus(item, options);
  }

  if (item.kind === "tp") {
    return resolveTpParticipantTaskStatus(item, options);
  }

  if (item.kind === "ts") {
    return resolveTsParticipantTaskStatus(item, options);
  }

  const hasEntry = !!options.entry || !!options.participation;
  return buildParticipantTaskResult({
    state: hasEntry
      ? PARTICIPANT_TASK_STATES.CLOSED_JOINED
      : PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED,
  });
}

export function getParticipantContextForItem(item, participationMaps = {}) {
  if (item?.kind === "fgc") {
    const row = participationMaps?.fgc?.[item.id] || null;
    return {
      participation: row,
      entry: row?.data ?? null,
      hasPick: !!row?.hasPick,
    };
  }

  if (item?.kind === "tp") {
    const entry = participationMaps?.tp?.[item.id] ?? null;
    return { entry, participation: entry };
  }

  if (item?.kind === "ts") {
    return { entry: participationMaps?.ts?.[item.id] ?? null };
  }

  return {};
}

export function resolveParticipantTaskStatusForItem(
  item,
  { isToday = false, participationMaps = {}, scheduleStatus, scheduleByGameId = {} } = {}
) {
  const ctx = getParticipantContextForItem(item, participationMaps);
  return resolveParticipantTaskStatus(item, {
    isToday,
    scheduleStatus,
    scheduleByGameId,
    ...ctx,
  });
}

export function participantHasJoined(task) {
  if (!task) return false;
  return (
    task.state === PARTICIPANT_TASK_STATES.DONE_WAITING ||
    task.state === PARTICIPANT_TASK_STATES.PARTIAL ||
    task.state === PARTICIPANT_TASK_STATES.CLOSED_JOINED
  );
}

export function getParticipantTaskStatusUi(state) {
  switch (state) {
    case PARTICIPANT_TASK_STATES.ACTION_REQUIRED:
      return {
        color: "#b91c1c",
        icon: "ellipse-outline",
        bg: "rgba(185,28,28,0.10)",
      };
    case PARTICIPANT_TASK_STATES.PARTIAL:
      return {
        color: "#ea580c",
        icon: "time-outline",
        bg: "rgba(234,88,12,0.10)",
      };
    case PARTICIPANT_TASK_STATES.DONE_WAITING:
    case PARTICIPANT_TASK_STATES.CLOSED_JOINED:
      return {
        color: "#16a34a",
        icon: "checkmark-circle",
        bg: "rgba(22,163,74,0.10)",
      };
    case PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED:
    default:
      return {
        color: "#9ca3af",
        icon: "ellipse-outline",
        bg: "rgba(156,163,175,0.12)",
      };
  }
}

export function formatParticipantTaskLabel(task) {
  const done = toNumber(task?.progress?.done, 0);
  const total = toNumber(task?.progress?.total, 0);

  switch (task?.state) {
    case PARTICIPANT_TASK_STATES.ACTION_REQUIRED:
      return i18n.t("participant.actionRequired", { defaultValue: "À faire" });
    case PARTICIPANT_TASK_STATES.PARTIAL:
      return i18n.t("participant.partial", {
        defaultValue: "À compléter · {{done}}/{{total}}",
        done,
        total,
      });
    case PARTICIPANT_TASK_STATES.DONE_WAITING:
    case PARTICIPANT_TASK_STATES.CLOSED_JOINED:
      return i18n.t("participant.joined", { defaultValue: "Inscrit" });
    case PARTICIPANT_TASK_STATES.CLOSED_NOT_JOINED:
    default:
      return i18n.t("participant.notJoined", { defaultValue: "Non inscrit" });
  }
}

export function formatParticipantProgressHint(task) {
  if (!task?.progressHint) return null;
  const done = toNumber(task?.progress?.done, 0);
  const total = toNumber(task?.progress?.total, 0);
  if (total <= 0 || done <= 0 || done >= total) return null;
  return i18n.t("participant.picksProgressHint", {
    defaultValue: "{{done}}/{{total}} matchs prédits",
    done,
    total,
  });
}

export function formatParticipantCtaLabel(ctaKey) {
  switch (ctaKey) {
    case "participate":
      return i18n.t("participant.cta.participate", { defaultValue: "Participer" });
    case "complete":
      return i18n.t("participant.cta.complete", { defaultValue: "Compléter" });
    case "modify":
      return i18n.t("participant.cta.modify", { defaultValue: "Modifier" });
    default:
      return null;
  }
}
