// functions/utils.js
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

if (getApps().length === 0) initializeApp();
export const db = getFirestore();
export { FieldValue, logger };

// --- Helpers communs ---
export const UA_HEADERS = { "User-Agent": "prophetik/1.0", Accept: "application/json" };

export function numOrNull(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}
export function readAnyBalance(doc) {
  return (
    numOrNull(doc?.credits?.balance) ??
    numOrNull(doc?.credits) ??
    numOrNull(doc?.credit) ??
    numOrNull(doc?.balance) ??
    0
  );
}
export const readTS = (v) => (v?.toDate?.() ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);
export const toYMD = (d) => {
  const x = typeof d === "string" ? new Date(d) : d instanceof Date ? d : new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export function splitEven(total, n) {
  if (n <= 0 || !(total > 0)) return Array.from({ length: Math.max(0, n) }, () => 0);
  const base = Math.floor(total / n);
  let r = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < r ? base + 1 : base));
}

export async function safeFetchJson(url, { method = "GET", headers = {}, timeoutMs = 10000, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers: { ...UA_HEADERS, ...headers }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${await res.text()}`);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < retries) await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  throw lastErr || new Error("fetch failed");
}
 
// Date YYYY-MM-DD en fuseau America/Toronto
export function torontoYMD(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

// --- NHL helpers partagés ---
export const apiWebSchedule = (ymd) => safeFetchJson(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`);
export const apiWebPbp      = (gid) => safeFetchJson(`https://api-web.nhle.com/v1/gamecenter/${encodeURIComponent(gid)}/play-by-play`);
export const apiWebRoster   = (t)   => safeFetchJson(`https://api-web.nhle.com/v1/roster/${encodeURIComponent(t.abbr)}/current`);