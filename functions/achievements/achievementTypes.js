/**
 * JSDoc types partagés pour le module achievements (pas de runtime).
 */

/**
 * @typedef {Object} ParticipantStats
 * @property {number} currentStreak
 * @property {number} bestStreak
 * @property {string|null} lastParticipationDate
 * @property {number} totalParticipations
 * @property {number} totalCorrectPredictions
 * @property {number} exactScores
 * @property {number} fgcWins
 * @property {number} tsFivePointNights
 */

/**
 * @typedef {Object} UnlockedAchievement
 * @property {true} unlocked
 * @property {import('firebase-admin/firestore').Timestamp} unlockedAt
 */

/**
 * @typedef {Record<string, UnlockedAchievement>} ParticipantAchievements
 */

/**
 * @typedef {Object} AchievementDefinition
 * @property {string} id
 * @property {string} category
 * @property {string} nameFr
 * @property {string} descriptionFr
 * @property {string} nameEn
 * @property {string} descriptionEn
 * @property {keyof ParticipantStats} statKey
 * @property {number} threshold
 */

export {};
