/**
 * Modèle de progression global participant (badges + streak).
 *
 * Stocké sur participants/{uid} :
 *
 * stats: {
 *   currentStreak: number,
 *   bestStreak: number,
 *   lastParticipationDate: string | null, // YYYY-MM-DD (America/Toronto)
 *   totalParticipations: number,
 *   totalCorrectPredictions: number,
 *   exactScores: number,
 *   fgcWins: number,
 *   tsFivePointNights: number,
 * }
 *
 * achievements: {
 *   [achievementId]: {
 *     unlocked: true,
 *     unlockedAt: Timestamp,
 *   }
 * }
 *
 * Seuls les badges débloqués sont persistés dans achievements.
 * Les events badge_unlocked vivent dans participants/{uid}/events/{eventId}.
 */

export const PARTICIPATION_DATE_TZ = "America/Toronto";

export const STAT_KEYS = Object.freeze({
  CURRENT_STREAK: "currentStreak",
  BEST_STREAK: "bestStreak",
  LAST_PARTICIPATION_DATE: "lastParticipationDate",
  TOTAL_PARTICIPATIONS: "totalParticipations",
  TOTAL_CORRECT_PREDICTIONS: "totalCorrectPredictions",
  EXACT_SCORES: "exactScores",
  FGC_WINS: "fgcWins",
  TS_FIVE_POINT_NIGHTS: "tsFivePointNights",
});

/** Valeurs par défaut pour participants/{uid}.stats */
export function buildDefaultParticipantStats() {
  return {
    [STAT_KEYS.CURRENT_STREAK]: 0,
    [STAT_KEYS.BEST_STREAK]: 0,
    [STAT_KEYS.LAST_PARTICIPATION_DATE]: null,
    [STAT_KEYS.TOTAL_PARTICIPATIONS]: 0,
    [STAT_KEYS.TOTAL_CORRECT_PREDICTIONS]: 0,
    [STAT_KEYS.EXACT_SCORES]: 0,
    [STAT_KEYS.FGC_WINS]: 0,
    [STAT_KEYS.TS_FIVE_POINT_NIGHTS]: 0,
  };
}

/** achievements absent ou {} tant qu'aucun badge n'est débloqué */
export function buildDefaultParticipantAchievements() {
  return {};
}

/**
 * Fusionne les stats existantes avec les defaults sans écraser les valeurs présentes.
 */
export function mergeParticipantStats(existingStats) {
  const defaults = buildDefaultParticipantStats();
  const current = existingStats && typeof existingStats === "object" ? existingStats : {};

  return {
    ...defaults,
    ...current,
    [STAT_KEYS.LAST_PARTICIPATION_DATE]:
      current[STAT_KEYS.LAST_PARTICIPATION_DATE] ?? defaults[STAT_KEYS.LAST_PARTICIPATION_DATE],
  };
}

/**
 * Normalise achievements : objet map id -> { unlocked, unlockedAt } ou {}.
 */
export function normalizeParticipantAchievements(existingAchievements) {
  if (!existingAchievements || typeof existingAchievements !== "object") {
    return buildDefaultParticipantAchievements();
  }
  return existingAchievements;
}
