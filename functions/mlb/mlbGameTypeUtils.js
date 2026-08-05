/** Types de match MLB éligibles aux défis Prophetik (saison + séries). */

export const MLB_REGULAR_GAME_TYPE = "R";

/** Wild Card, Division, LCS, World Series, etc. */
export const MLB_POSTSEASON_GAME_TYPES = new Set(["P", "F", "D", "L", "W", "C"]);

/** Spring training, All-Star, exhibition — exclus des défis. */
export const MLB_EXCLUDED_GAME_TYPES = new Set(["S", "A", "E", "N"]);

/** Paramètre `gameTypes` pour statsapi (régulière + séries). */
export const MLB_CHALLENGE_ELIGIBLE_GAME_TYPES = "R,F,D,L,W,P";

export function normalizeMlbGameType(gameType) {
  return String(gameType || MLB_REGULAR_GAME_TYPE)
    .trim()
    .toUpperCase();
}

export function isMlbPostseasonGameType(gameType) {
  const t = normalizeMlbGameType(gameType);
  if (t === MLB_REGULAR_GAME_TYPE) return false;
  if (MLB_EXCLUDED_GAME_TYPES.has(t)) return false;
  return MLB_POSTSEASON_GAME_TYPES.has(t);
}

export function isMlbChallengeEligibleGameType(gameType) {
  const t = normalizeMlbGameType(gameType);
  if (!t || t === MLB_REGULAR_GAME_TYPE) return true;
  if (MLB_EXCLUDED_GAME_TYPES.has(t)) return false;
  return isMlbPostseasonGameType(t);
}

export function mlbSeasonPhaseFromGameType(gameType) {
  return isMlbPostseasonGameType(gameType) ? "playoffs" : "regular";
}
