// app/defis/[defiId]/utils/defiFormatters.js

export function fmtUTCDateStr(d) {
  if (!d) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}



export function toYMD(v) {
  if (!v) return null;

  // Si déjà une string "YYYY-MM-DD"
  if (typeof v === "string") {
    const s = v.trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  const d = v?.toDate?.() ? v.toDate() : v instanceof Date ? v : new Date(v);
  if (!d || Number.isNaN(d.getTime())) return null;

  // UTC stable
  return fmtUTCDateStr(d);
}

export function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

export function fmtTSLocalHM(v) {
  try {
    const d = v?.toDate?.() ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null;
    if (!d) return "—";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "—";
  }
}

export function fmtStartLocalHMFromUTCString(startTimeUTC) {
  try {
    if (!startTimeUTC) return "—";
    const d = new Date(startTimeUTC);
    if (!d || Number.isNaN(d.getTime())) return "—";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "—";
  }
}

export function fmtSigned(n) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0";
  return x > 0 ? `+${x}` : `${x}`;
}

export function isPast(ts) {
  if (!ts) return false;
  const d = ts?.toDate?.() ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
  return Date.now() > d.getTime();
}

// Impact = (coeff - 1) * 100
export function impactPct(coeff) {
  const c = Number(coeff);
  if (!Number.isFinite(c)) return null;
  return (c - 1) * 100;
}

export function fmtImpact(pct, digits = 1) {
  if (pct == null) return "—";
  const s = pct >= 0 ? "+" : "";
  return `${s}${pct.toFixed(digits)}%`;
}

export function impactBand(pct) {
  if (pct == null) return "neutral";
  if (pct >= 3) return "up";
  if (pct <= -3) return "down";
  return "neutral";
}

export function ymdTorontoFromUTC(v) {
  try {
    const d =
      typeof v === "string" ? new Date(v) :
      v?.toDate ? v.toDate() :
      v instanceof Date ? v :
      null;

    if (!d || isNaN(d.getTime())) return null;

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return null;
  }
}