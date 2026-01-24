// src/home/homeUtils.js
import i18n from "@src/i18n/i18n";

// ----------------------------- Date helpers -----------------------------
export function toDateOrNull(v) {
  try {
    if (!v) return null;
    if (v?.toDate) return v.toDate();
    if (v instanceof Date) return v;
    return new Date(v);
  } catch {
    return null;
  }
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

// Status UI basé sur le temps réel (firstGameUTC)
export function computeUiStatus(defi) {
  const raw = String(defi?.status || "").toLowerCase();
  const now = new Date();
  const firstGame = toDateOrNull(defi?.firstGameUTC);

  if (raw === "completed" || raw === "awaiting_result" || raw === "live") return raw;

  if (raw === "open") {
    if (firstGame && firstGame.getTime() <= now.getTime()) return "live";
    return "open";
  }

  return raw;
}

export function statusStyle(s) {
  const k = String(s || "").toLowerCase();
  if (k === "open")
    return { bg: "#ECFDF5", fg: "#065F46", icon: "clock-outline", label: i18n.t("home.status.open") };
  if (k === "live")
    return { bg: "#EFF6FF", fg: "#1D4ED8", icon: "broadcast", label: i18n.t("home.status.live") };
  if (k === "awaiting_result")
    return { bg: "#FFF7ED", fg: "#9A3412", icon: "timer-sand", label: i18n.t("home.status.awaiting") };
  if (k === "completed")
    return { bg: "#F3F4F6", fg: "#111827", icon: "check-decagram", label: i18n.t("home.status.completed") };
  return { bg: "#F3F4F6", fg: "#374151", icon: "help-circle-outline", label: s || "—" };
}

// ----------------------------- Entitlements UI -----------------------------
export function allowedTypesForTierUi(tier) {
  const t = String(tier || "free").toLowerCase();
  if (t === "free") return new Set([1, 2, 3, 4]);
  if (t === "pro") return new Set([1, 2, 3, 4, 5, 6, 7]);
  if (t === "vip") return null; // tout permis
  return new Set([1, 2, 3, 4]);
}

export function canJoinDefiUi({ tier, defiType, uiStatus, signupDeadline }) {
  if (String(uiStatus).toLowerCase() !== "open") return { canJoin: false, lockedBy: "STATUS" };

  const dl = toDateOrNull(signupDeadline);
  if (dl && dl.getTime() <= Date.now()) return { canJoin: false, lockedBy: "DEADLINE" };

  const allowSet = allowedTypesForTierUi(tier);
  const t = Number(defiType || 0);

  if (!Number.isFinite(t) || t <= 0) return { canJoin: false, lockedBy: "TYPE_INVALID" };
  if (allowSet && !allowSet.has(t)) return { canJoin: false, lockedBy: "PLAN" };

  return { canJoin: true, lockedBy: null };
}

// ----------------------------- Misc -----------------------------
export function friendlyError(e) {
  if (!e) return i18n.t("common.unknownError");
  if (e?.code === "permission-denied") return i18n.t("errors.firestorePermission");
  return String(e?.message || e);
}

export function shortUid(uid) {
  const s = String(uid || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes("?") ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

export function readPointsBalanceAny(doc) {
  const a = doc?.points?.balance;
  if (typeof a === "number") return a;
  if (typeof doc?.points === "number") return doc.points;

  const b = doc?.credits?.balance;
  if (typeof b === "number") return b;
  if (typeof doc?.credits === "number") return doc.credits;

  if (typeof doc?.balance === "number") return doc.balance;
  return 0;
}

// ----------------------------- Ascension labels -----------------------------
export function isAscensionDefi(defi) {
  return !!defi?.ascension?.key;
}

export function ascLabel(defi) {
  const key = String(defi?.ascension?.key || "");
  const step = Number(defi?.ascension?.stepType || 0);
  const t = Number(defi?.type || 0);

  if (!key) return null;
  if (key === "ASC7") return `Ascension 7 — Jour ${step}/7 (${t}x${t})`;
  if (key === "ASC4") return `Ascension 4 — Jour ${step}/4 (${t}x${t})`;
  return `Ascension — Étape ${step} (${t}x${t})`;
}

export function normalDefiLabel(defi) {
  const t = Number(defi?.type || 0);
  return t ? `${i18n.t("home.challenge")} ${t}x${t}` : i18n.t("home.challenge");
}

export function ascensionIconSource(ascKey) {
  const k = String(ascKey || "").toUpperCase();
  if (k === "ASC7") return require("@src/assets/asc7.png");
  if (k === "ASC4") return require("@src/assets/asc4.png");
  return null;
}