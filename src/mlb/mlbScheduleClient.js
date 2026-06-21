/** Normalise un YMD vers le format doc Firestore mlb_schedule_daily (YYYYMMDD). */
export function normalizeMlbScheduleYmdCompact(v) {
  const compact = String(v || "").replace(/\D/g, "");
  return compact.length === 8 ? compact : "";
}

export function mlbScheduleGameDocPath(gameYmd, gameId) {
  const ymd = normalizeMlbScheduleYmdCompact(gameYmd);
  const id = String(gameId || "").trim();
  if (!ymd || !id) return null;
  return `mlb_schedule_daily/${ymd}/games/${id}`;
}
