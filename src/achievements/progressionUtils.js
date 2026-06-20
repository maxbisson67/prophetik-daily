import {
  MVP_ACHIEVEMENT_COUNT,
  MVP_ACHIEVEMENT_DEFINITIONS,
  CATEGORY_ORDER,
} from "./mvpAchievements.js";

export const DEFAULT_STATS = Object.freeze({
  currentStreak: 0,
  bestStreak: 0,
  lastParticipationDate: null,
  totalParticipations: 0,
  totalCorrectPredictions: 0,
  exactScores: 0,
  fgcWins: 0,
  tsFivePointNights: 0,
});

export function normalizeStats(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATS };
  return {
    ...DEFAULT_STATS,
    ...raw,
    lastParticipationDate: raw.lastParticipationDate ?? null,
  };
}

export function normalizeAchievements(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}

export function isAchievementUnlocked(achievements, achievementId) {
  return achievements?.[achievementId]?.unlocked === true;
}

export function countUnlockedAchievements(achievements) {
  const map = normalizeAchievements(achievements);
  return MVP_ACHIEVEMENT_DEFINITIONS.filter((def) => isAchievementUnlocked(map, def.id)).length;
}

export function getBadgeProgress(def, stats) {
  const current = Math.max(0, Number(stats?.[def.statKey] ?? 0));
  const threshold = Math.max(1, Number(def.threshold || 1));
  return {
    current,
    threshold,
    pct: Math.min(100, Math.round((current / threshold) * 100)),
  };
}

export function groupAchievementsByCategory(definitions = MVP_ACHIEVEMENT_DEFINITIONS) {
  const groups = Object.fromEntries(CATEGORY_ORDER.map((cat) => [cat, []]));
  for (const def of definitions) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push(def);
  }
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: groups[category] || [],
  })).filter((g) => g.items.length > 0);
}

export function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts.seconds === "number") {
    return new Date(ts.seconds * 1000);
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatUnlockedDate(ts, locale) {
  const d = tsToDate(ts);
  if (!d) return "";
  try {
    return d.toLocaleDateString(locale || undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
