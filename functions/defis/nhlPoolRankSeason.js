import { getNhlPreviousSeasonId } from "../players/seasonHelpers.js";

/** Inclusif : rang basé sur N-1 si gameDateYmd <= cette date. */
export const DEFAULT_POOL_RANK_USES_PREVIOUS_UNTIL_YMD = "2026-10-14";

export function getNhlCalendarSeasonIdFromGameYmd(gameDateYmd) {
  const ymd = String(gameDateYmd || "").slice(0, 10);
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return getNhlCalendarSeasonIdFromGameYmd(new Date().toISOString());
  const start = m >= 7 ? y : y - 1;
  return `${start}${start + 1}`;
}

export function resolvePoolRankUsesPreviousUntilYmd(seasonConfig) {
  const fromConfig = String(seasonConfig?.poolRankUsesPreviousUntilYmd || "").slice(0, 10);
  return fromConfig || DEFAULT_POOL_RANK_USES_PREVIOUS_UNTIL_YMD;
}

/**
 * @returns {{
 *   calendarSeasonId: string,
 *   previousSeasonId: string|null,
 *   rankSeasonId: string,
 *   usedPreviousForRank: boolean,
 *   poolRankUsesPreviousUntilYmd: string,
 * }}
 */
export function resolveNhlPoolRankSeasonForGame({ gameDateYmd, seasonConfig = null } = {}) {
  const ymd = String(gameDateYmd || "").slice(0, 10);
  const untilYmd = resolvePoolRankUsesPreviousUntilYmd(seasonConfig);
  const calendarSeasonId = getNhlCalendarSeasonIdFromGameYmd(ymd);
  const previousSeasonId = getNhlPreviousSeasonId(calendarSeasonId);
  const usedPreviousForRank = Boolean(previousSeasonId && ymd <= untilYmd);
  const rankSeasonId = usedPreviousForRank && previousSeasonId ? previousSeasonId : calendarSeasonId;

  return {
    calendarSeasonId,
    previousSeasonId,
    rankSeasonId,
    usedPreviousForRank,
    poolRankUsesPreviousUntilYmd: untilYmd,
  };
}
