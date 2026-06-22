import { MVP_ACHIEVEMENT_DEFINITIONS } from "./mvpAchievements.js";

/**
 * Regroupement visuel des badges (affichage seulement — ids inchangés).
 */
export const BADGE_DISPLAY_SECTIONS = Object.freeze([
  {
    id: "participation",
    emoji: "🏁",
    titleKey: "progression.displaySections.participation",
    defaultTitle: "Participation",
    badgeIds: ["FIRST_CHALLENGE", "TEN_CHALLENGES"],
  },
  {
    id: "prediction",
    emoji: "🎯",
    titleKey: "progression.displaySections.prediction",
    defaultTitle: "Prédictions",
    badgeIds: ["FIRST_CORRECT_PREDICTION", "TEN_CORRECT_PREDICTIONS"],
  },
  {
    id: "streak",
    emoji: "🔥",
    titleKey: "progression.displaySections.streak",
    defaultTitle: "Séries",
    badgeIds: ["STREAK_3", "STREAK_7"],
  },
  {
    id: "fgc",
    emoji: "🥅",
    titleKey: "progression.displaySections.fgc",
    defaultTitle: "FGC",
    badgeIds: ["FIRST_FGC_WIN"],
  },
  {
    id: "performance",
    emoji: "⭐",
    titleKey: "progression.displaySections.performance",
    defaultTitle: "Performances",
    badgeIds: ["FIRST_EXACT_SCORE", "FIRST_TS_FIVE_POINTS"],
  },
  {
    id: "prestige",
    emoji: "👑",
    titleKey: "progression.displaySections.prestige",
    defaultTitle: "Prestige",
    badgeIds: ["FIFTY_CHALLENGES", "FIFTY_CORRECT_PREDICTIONS", "STREAK_30"],
  },
]);

const DEF_BY_ID = Object.fromEntries(MVP_ACHIEVEMENT_DEFINITIONS.map((d) => [d.id, d]));

export function groupBadgesForDisplay() {
  return BADGE_DISPLAY_SECTIONS.map((section) => ({
    ...section,
    items: section.badgeIds.map((id) => DEF_BY_ID[id]).filter(Boolean),
  })).filter((section) => section.items.length > 0);
}
