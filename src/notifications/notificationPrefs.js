export const NOTIFICATION_PREF_KEYS = {
  MORNING_CHALLENGES: "morningChallenges",
  TS_WIN: "tsWin",
  TP_EXACT_SCORE: "tpExactScore",
  FGC_WIN: "fgcWin",
  LEADERBOARD_RANK_UP: "leaderboardRankUp",
};

export const DEFAULT_NOTIFICATION_PREFS = {
  [NOTIFICATION_PREF_KEYS.MORNING_CHALLENGES]: true,
  [NOTIFICATION_PREF_KEYS.TS_WIN]: true,
  [NOTIFICATION_PREF_KEYS.TP_EXACT_SCORE]: true,
  [NOTIFICATION_PREF_KEYS.FGC_WIN]: true,
  [NOTIFICATION_PREF_KEYS.LEADERBOARD_RANK_UP]: true,
};

export function resolveNotificationPrefs(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...src,
  };
}

export function isNotificationPrefEnabled(prefs, key) {
  const resolved = resolveNotificationPrefs(prefs);
  return resolved[key] !== false;
}
