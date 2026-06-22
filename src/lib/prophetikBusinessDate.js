/** Jour Prophetik : America/Toronto, bascule à 4h. */

export const APP_TZ = "America/Toronto";

export function toYmdInTz(inputDate = new Date(), timeZone = APP_TZ) {
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

export function addDaysToYmd(baseYmd, delta) {
  const s = String(baseYmd || "");
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = s.match(/^(\d{4})(\d{2})(\d{2})/);

  let y;
  let mo;
  let d;

  if (m1) {
    y = Number(m1[1]);
    mo = Number(m1[2]);
    d = Number(m1[3]);
  } else if (m2) {
    y = Number(m2[1]);
    mo = Number(m2[2]);
    d = Number(m2[3]);
  } else {
    return s;
  }

  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + delta);

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");

  return `${yy}-${mm}-${dd}`;
}

function hourInAppTz(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date instanceof Date ? date : new Date(date));

  return Number(parts.find((p) => p.type === "hour")?.value || 0);
}

/** YYYY-MM-DD — jour Prophetik courant. */
export function getProphetikBusinessYmd(now = new Date()) {
  const ymd = toYmdInTz(now, APP_TZ);
  return hourInAppTz(now) < 4 ? addDaysToYmd(ymd, -1) : ymd;
}

/** YYYYMMDD — format compact (bundles TP). */
export function getProphetikBusinessYmdCompact(now = new Date()) {
  return getProphetikBusinessYmd(now).replace(/-/g, "");
}

/** Date locale à minuit pour le jour Prophetik (addDays, labels). */
export function getProphetikBusinessDate(now = new Date()) {
  const ymd = getProphetikBusinessYmd(now);
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getPreviousProphetikBusinessYmdCompact(now = new Date()) {
  return addDaysToYmd(getProphetikBusinessYmd(now), -1).replace(/-/g, "");
}
