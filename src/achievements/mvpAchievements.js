/**
 * Définitions badges MVP (lecture seule côté client).
 * Les ids doivent rester synchronisés avec functions/achievements/achievementDefinitions.js
 */

export const MVP_ACHIEVEMENT_COUNT = 12;

export const ACHIEVEMENT_CATEGORIES = Object.freeze({
  PARTICIPATION: "participation",
  PREDICTION: "prediction",
  STREAK: "streak",
  MILESTONE: "milestone",
});

/** @type {ReadonlyArray<{ id: string, category: string, statKey: string, threshold: number, icon: string }>} */
export const MVP_ACHIEVEMENT_DEFINITIONS = Object.freeze([
  {
    id: "FIRST_CHALLENGE",
    category: ACHIEVEMENT_CATEGORIES.PARTICIPATION,
    statKey: "totalParticipations",
    threshold: 1,
    icon: "flag-checkered",
  },
  {
    id: "TEN_CHALLENGES",
    category: ACHIEVEMENT_CATEGORIES.PARTICIPATION,
    statKey: "totalParticipations",
    threshold: 10,
    icon: "numeric-10-box-multiple-outline",
  },
  {
    id: "FIFTY_CHALLENGES",
    category: ACHIEVEMENT_CATEGORIES.PARTICIPATION,
    statKey: "totalParticipations",
    threshold: 50,
    icon: "medal-outline",
  },
  {
    id: "FIRST_CORRECT_PREDICTION",
    category: ACHIEVEMENT_CATEGORIES.PREDICTION,
    statKey: "totalCorrectPredictions",
    threshold: 1,
    icon: "bullseye-arrow",
  },
  {
    id: "TEN_CORRECT_PREDICTIONS",
    category: ACHIEVEMENT_CATEGORIES.PREDICTION,
    statKey: "totalCorrectPredictions",
    threshold: 10,
    icon: "target",
  },
  {
    id: "FIFTY_CORRECT_PREDICTIONS",
    category: ACHIEVEMENT_CATEGORIES.PREDICTION,
    statKey: "totalCorrectPredictions",
    threshold: 50,
    icon: "crosshairs-gps",
  },
  {
    id: "STREAK_3",
    category: ACHIEVEMENT_CATEGORIES.STREAK,
    statKey: "bestStreak",
    threshold: 3,
    icon: "fire",
  },
  {
    id: "STREAK_7",
    category: ACHIEVEMENT_CATEGORIES.STREAK,
    statKey: "bestStreak",
    threshold: 7,
    icon: "fire-circle",
  },
  {
    id: "STREAK_30",
    category: ACHIEVEMENT_CATEGORIES.STREAK,
    statKey: "bestStreak",
    threshold: 30,
    icon: "calendar-star",
  },
  {
    id: "FIRST_EXACT_SCORE",
    category: ACHIEVEMENT_CATEGORIES.MILESTONE,
    statKey: "exactScores",
    threshold: 1,
    icon: "scoreboard-outline",
  },
  {
    id: "FIRST_FGC_WIN",
    category: ACHIEVEMENT_CATEGORIES.MILESTONE,
    statKey: "fgcWins",
    threshold: 1,
    icon: "trophy-outline",
  },
  {
    id: "FIRST_TS_FIVE_POINTS",
    category: ACHIEVEMENT_CATEGORIES.MILESTONE,
    statKey: "tsFivePointNights",
    threshold: 1,
    icon: "star-four-points-outline",
  },
]);

export const CATEGORY_ORDER = [
  ACHIEVEMENT_CATEGORIES.PARTICIPATION,
  ACHIEVEMENT_CATEGORIES.PREDICTION,
  ACHIEVEMENT_CATEGORIES.STREAK,
  ACHIEVEMENT_CATEGORIES.MILESTONE,
];

export function getAchievementDefinition(achievementId) {
  const id = String(achievementId || "").trim();
  return MVP_ACHIEVEMENT_DEFINITIONS.find((def) => def.id === id) || null;
}
