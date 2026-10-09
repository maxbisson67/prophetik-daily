function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

/** Mappe un doc `nhl_schedule_daily/{yyyymmdd}/games/{gameId}` vers le format Match Live. */
export function mapNhlScheduleGameToLiveGame(row = {}, ymd = "") {
  const gameId = String(row?.gameId || row?.id || "").trim();
  const state = String(row?.gameState || row?.gameScheduleState || "").toUpperCase();
  const isLive = ["LIVE", "CRIT", "STARTED"].includes(state);
  const isFinal = ["FINAL", "OFF"].includes(state);

  return {
    id: gameId,
    gameId,
    ymd,
    awayAbbr: safeAbbr(row?.away?.abbr || row?.awayAbbr),
    homeAbbr: safeAbbr(row?.home?.abbr || row?.homeAbbr),
    awayScore: row?.awayScore != null ? Number(row.awayScore) : null,
    homeScore: row?.homeScore != null ? Number(row.homeScore) : null,
    isLive,
    isFinal,
    period: row?.period ?? null,
    periodType: row?.periodType || null,
    timeRemaining: row?.clock?.timeRemaining || null,
    inIntermission: row?.clock?.inIntermission ?? null,
    startTimeUTC: row?.startTimeUTC || null,
    venue: row?.venue?.default || row?.venueName || null,
    statusText: isLive
      ? state
      : isFinal
        ? "Final"
        : row?.gameScheduleState || "Scheduled",
  };
}
