// functions/ProphetikDate.js

// Fuseau principal de l'app (défis, gameDate, etc.)
export const APP_TZ = "America/Toronto";

// Fuseau de référence pour la NHL (équivalent pratique)
export const NHL_TZ = "America/New_York";

/**
 * Instant UTC courant (Date JS standard).
 */
export function nowUtc() {
  return new Date();
}

/**
 * Formate un Date / timestamp / string en "YYYY-MM-DD" dans un fuseau donné.
 *
 * @param {Date | number | string | undefined} inputDate
 * @param {string} timeZone
 */
export function toYmdInTz(inputDate, timeZone = "UTC") {
  const date =
    inputDate instanceof Date
      ? inputDate
      : inputDate !== undefined
      ? new Date(inputDate)
      : new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

/**
 * Date applicative (défis, gameDate, etc.) en "YYYY-MM-DD" selon APP_TZ.
 */
export function appYmd(inputDate) {
  return toYmdInTz(inputDate, APP_TZ);
}

/**
 * Date NHL en "YYYY-MM-DD" selon le fuseau officiel de la ligue.
 */
export function nhlYmd(inputDate) {
  return toYmdInTz(inputDate, NHL_TZ);
}

/**
 * Alias explicite pour "date NHL du jour" (ou d’un instant donné) au format YYYYMMDD.
 * (utile pour les endpoints qui attendent ce format)
 */
export function computeNhlYmd(inputDate) {
  const d = nhlYmd(inputDate); // "YYYY-MM-DD"
  return d.replace(/-/g, "");  // "YYYYMMDD"
}

/**
 * Ajoute delta jours à une date JS et retourne une nouvelle Date.
 */
export function addDays(date, delta) {
  const d =
    date instanceof Date
      ? new Date(date.getTime())
      : date
      ? new Date(date)
      : new Date();
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Ajoute delta jours à un YMD "YYYY-MM-DD" (ou "YYYYMMDD") et retourne "YYYY-MM-DD".
 */
export function addDaysToYmd(baseYmd, delta) {
  if (!baseYmd || typeof baseYmd !== "string") return baseYmd;
  let y, m, d;

  const m1 = baseYmd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = baseYmd.match(/^(\d{4})(\d{2})(\d{2})/);

  if (m1) {
    [y, m, d] = [m1[1], m1[2], m1[3]];
  } else if (m2) {
    [y, m, d] = [m2[1], m2[2], m2[3]];
  } else {
    return baseYmd;
  }

  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  dt.setDate(dt.getDate() + delta);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");

  return `${yy}-${mm}-${dd}`;
}

/**
 * Format lisible pour les logs, dans un fuseau donné.
 */
export function formatDebug(date, timeZone = "UTC") {
  const d =
    date instanceof Date
      ? date
      : date
      ? new Date(date)
      : new Date();

  return new Intl.DateTimeFormat("fr-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

/**
 * Petit helper pour obtenir "YYYY-MM-DD" aujourd’hui dans le fuseau de l’app.
 * (équivalent de ton ancien torontoYMD(new Date()))
 */
export function todayAppYmd() {
  return appYmd();
}

/**
 * Même chose côté NHL.
 */
export function todayNhlYmd() {
  return nhlYmd();
}