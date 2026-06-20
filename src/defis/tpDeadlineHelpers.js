export const TP_DISPLAY_TZ = "America/Toronto";
export const TP_LOCK_BEFORE_MS = 5 * 60 * 1000;

export function toDateAny(ts) {
  if (ts == null) return null;

  try {
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;

    if (typeof ts === "number" && Number.isFinite(ts)) {
      return new Date(ts < 1e12 ? ts * 1000 : ts);
    }

    if (typeof ts === "object") {
      const seconds = ts._seconds ?? ts.seconds;
      if (typeof seconds === "number") {
        const nanos = ts._nanoseconds ?? ts.nanoseconds ?? 0;
        return new Date(seconds * 1000 + nanos / 1e6);
      }
    }

    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function fmtTimeShort(ts, timeZone = TP_DISPLAY_TZ) {
  const d = toDateAny(ts);
  if (!d || Number.isNaN(d.getTime?.())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

export function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return hh !== "00" ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatSlotMatchup(slot) {
  const away = String(slot?.awayAbbr || "").trim().toUpperCase();
  const home = String(slot?.homeAbbr || "").trim().toUpperCase();
  if (!away || !home) return "";
  return `${away} @ ${home}`;
}

export function getSlotLockedAt(slot) {
  const lockedAt = toDateAny(slot?.lockedAt);
  if (lockedAt) return lockedAt;

  const start = toDateAny(slot?.gameStartTimeUTC);
  if (start) return new Date(start.getTime() - TP_LOCK_BEFORE_MS);

  return null;
}

export function isSlotLocked(slot, nowMs = Date.now()) {
  const status = String(slot?.status || "open").toLowerCase();
  if (status !== "open") return true;

  const lockedAt = getSlotLockedAt(slot);
  if (lockedAt && nowMs >= lockedAt.getTime()) return true;

  return false;
}

export function getEarliestOpenSlot(games = []) {
  const slots = Array.isArray(games) ? games : [];
  let lockedAt = null;
  let slot = null;

  for (const candidate of slots) {
    if (isSlotLocked(candidate)) continue;
    const candidateLockedAt = getSlotLockedAt(candidate);
    if (!candidateLockedAt) continue;
    if (!lockedAt || candidateLockedAt.getTime() < lockedAt.getTime()) {
      lockedAt = candidateLockedAt;
      slot = candidate;
    }
  }

  return { lockedAt, slot };
}
