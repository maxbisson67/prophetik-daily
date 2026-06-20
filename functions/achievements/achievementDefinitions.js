/**
 * Badges MVP Prophetik — source de vérité côté Cloud Functions.
 * Le client lit ces ids depuis participants/{uid}.achievements mais ne débloque jamais lui-même.
 */

export const MVP_ACHIEVEMENT_COUNT = 12;

export const ACHIEVEMENT_CATEGORIES = Object.freeze({
  PARTICIPATION: "participation",
  PREDICTION: "prediction",
  STREAK: "streak",
  MILESTONE: "milestone",
});

/** @type {ReadonlyArray<import('./achievementTypes.js').AchievementDefinition>} */
export const MVP_ACHIEVEMENT_DEFINITIONS = Object.freeze([
  {
    id: "FIRST_CHALLENGE",
    category: ACHIEVEMENT_CATEGORIES.PARTICIPATION,
    nameFr: "Premier défi",
    descriptionFr: "Participer à ton premier défi Prophetik.",
    nameEn: "First challenge",
    descriptionEn: "Join your first Prophetik challenge.",
    statKey: "totalParticipations",
    threshold: 1,
  },
  {
    id: "TEN_CHALLENGES",
    category: ACHIEVEMENT_CATEGORIES.PARTICIPATION,
    nameFr: "10 défis",
    descriptionFr: "Participer à 10 défis.",
    nameEn: "10 challenges",
    descriptionEn: "Join 10 challenges.",
    statKey: "totalParticipations",
    threshold: 10,
  },
  {
    id: "FIFTY_CHALLENGES",
    category: ACHIEVEMENT_CATEGORIES.PARTICIPATION,
    nameFr: "50 défis",
    descriptionFr: "Participer à 50 défis.",
    nameEn: "50 challenges",
    descriptionEn: "Join 50 challenges.",
    statKey: "totalParticipations",
    threshold: 50,
  },
  {
    id: "FIRST_CORRECT_PREDICTION",
    category: ACHIEVEMENT_CATEGORIES.PREDICTION,
    nameFr: "Première bonne prédiction",
    descriptionFr: "Réussir ta première prédiction.",
    nameEn: "First correct prediction",
    descriptionEn: "Make your first correct prediction.",
    statKey: "totalCorrectPredictions",
    threshold: 1,
  },
  {
    id: "TEN_CORRECT_PREDICTIONS",
    category: ACHIEVEMENT_CATEGORIES.PREDICTION,
    nameFr: "10 bonnes prédictions",
    descriptionFr: "Réussir 10 prédictions.",
    nameEn: "10 correct predictions",
    descriptionEn: "Make 10 correct predictions.",
    statKey: "totalCorrectPredictions",
    threshold: 10,
  },
  {
    id: "FIFTY_CORRECT_PREDICTIONS",
    category: ACHIEVEMENT_CATEGORIES.PREDICTION,
    nameFr: "50 bonnes prédictions",
    descriptionFr: "Réussir 50 prédictions.",
    nameEn: "50 correct predictions",
    descriptionEn: "Make 50 correct predictions.",
    statKey: "totalCorrectPredictions",
    threshold: 50,
  },
  {
    id: "STREAK_3",
    category: ACHIEVEMENT_CATEGORIES.STREAK,
    nameFr: "Série de 3 jours",
    descriptionFr: "Participer 3 jours de suite.",
    nameEn: "3-day streak",
    descriptionEn: "Participate 3 days in a row.",
    statKey: "bestStreak",
    threshold: 3,
  },
  {
    id: "STREAK_7",
    category: ACHIEVEMENT_CATEGORIES.STREAK,
    nameFr: "Série de 7 jours",
    descriptionFr: "Participer 7 jours de suite.",
    nameEn: "7-day streak",
    descriptionEn: "Participate 7 days in a row.",
    statKey: "bestStreak",
    threshold: 7,
  },
  {
    id: "STREAK_30",
    category: ACHIEVEMENT_CATEGORIES.STREAK,
    nameFr: "Série de 30 jours",
    descriptionFr: "Participer 30 jours de suite.",
    nameEn: "30-day streak",
    descriptionEn: "Participate 30 days in a row.",
    statKey: "bestStreak",
    threshold: 30,
  },
  {
    id: "FIRST_EXACT_SCORE",
    category: ACHIEVEMENT_CATEGORIES.MILESTONE,
    nameFr: "Premier score exact",
    descriptionFr: "Obtenir ton premier score exact en prédiction d'équipe.",
    nameEn: "First exact score",
    descriptionEn: "Get your first exact score in a team prediction.",
    statKey: "exactScores",
    threshold: 1,
  },
  {
    id: "FIRST_FGC_WIN",
    category: ACHIEVEMENT_CATEGORIES.MILESTONE,
    nameFr: "Premier FGC gagné",
    descriptionFr: "Gagner ton premier défi premier but / point produit.",
    nameEn: "First FGC win",
    descriptionEn: "Win your first first-goal / first-RBI challenge.",
    statKey: "fgcWins",
    threshold: 1,
  },
  {
    id: "FIRST_TS_FIVE_POINTS",
    category: ACHIEVEMENT_CATEGORIES.MILESTONE,
    nameFr: "Première soirée à 5 points",
    descriptionFr: "Marquer 5 points ou plus en une soirée Team Scorer.",
    nameEn: "First 5-point night",
    descriptionEn: "Score 5 points or more in one Team Scorer night.",
    statKey: "tsFivePointNights",
    threshold: 1,
  },
]);

const BY_ID = Object.freeze(
  Object.fromEntries(MVP_ACHIEVEMENT_DEFINITIONS.map((def) => [def.id, def]))
);

export function getAchievementDefinition(achievementId) {
  const id = String(achievementId || "").trim();
  return BY_ID[id] || null;
}

export function listMvpAchievements() {
  return MVP_ACHIEVEMENT_DEFINITIONS;
}

export function isKnownAchievementId(achievementId) {
  return !!getAchievementDefinition(achievementId);
}
