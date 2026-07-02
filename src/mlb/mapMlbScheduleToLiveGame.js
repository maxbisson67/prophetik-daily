import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

/** Mappe un doc `mlb_schedule_daily/.../games/{gamePk}` vers le format Match Live. */
export function mapMlbScheduleGameToLiveGame(row = {}, ymd = "") {
  const gamePk = String(row?.gamePk || row?.id || "").trim();
  const away = row?.awayTeam || {};
  const home = row?.homeTeam || {};
  const status = row?.status || {};
  const abstract = String(status?.abstractGameState || "").toLowerCase();
  const postponed = isMlbGamePostponed(status);

  return {
    id: gamePk,
    gamePk,
    ymd,
    date: ymd,
    awayAbbr: safeAbbr(away?.abbreviation),
    homeAbbr: safeAbbr(home?.abbreviation),
    awayScore: away?.score != null ? Number(away.score) : null,
    homeScore: home?.score != null ? Number(home.score) : null,
    isLive: abstract === "live",
    isFinal: abstract === "final" && !postponed,
    isPostponed: postponed,
    currentInning: row?.currentInning != null ? Number(row.currentInning) : null,
    currentInningOrdinal: String(row?.currentInningOrdinal || ""),
    inningState: String(row?.inningState || ""),
    inningHalf: "",
    abstractGameState: String(status?.abstractGameState || ""),
    detailedState: String(status?.detailedState || ""),
    startTimeUTC: row?.startTimeUTC || row?.gameDateRaw || null,
    venue: row?.venue?.name || null,
  };
}
