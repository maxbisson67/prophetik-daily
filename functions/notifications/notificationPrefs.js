export const NOTIFICATION_PREF_KEYS = {
  MORNING_CHALLENGES: "morningChallenges",
  TS_WIN: "tsWin",
  TP_EXACT_SCORE: "tpExactScore",
  FGC_WIN: "fgcWin",
  LEADERBOARD_RANK_UP: "leaderboardRankUp",
};

/** Opt-out : absent ou true = notifications envoyées. */
export const DEFAULT_NOTIFICATION_PREFS = {
  [NOTIFICATION_PREF_KEYS.MORNING_CHALLENGES]: true,
  [NOTIFICATION_PREF_KEYS.TS_WIN]: true,
  [NOTIFICATION_PREF_KEYS.TP_EXACT_SCORE]: true,
  [NOTIFICATION_PREF_KEYS.FGC_WIN]: true,
  [NOTIFICATION_PREF_KEYS.LEADERBOARD_RANK_UP]: true,
};

export function isNotificationPrefEnabled(prefs, key) {
  if (!key) return true;
  if (!prefs || typeof prefs !== "object") {
    return DEFAULT_NOTIFICATION_PREFS[key] !== false;
  }
  if (prefs[key] === undefined) {
    return DEFAULT_NOTIFICATION_PREFS[key] !== false;
  }
  return prefs[key] !== false;
}

export async function filterUidsByNotificationPref(uids, prefKey, db) {
  const unique = Array.from(new Set((uids || []).map(String).filter(Boolean)));
  if (!unique.length || !prefKey) return unique;

  const enabled = [];

  await Promise.all(
    unique.map(async (uid) => {
      try {
        const snap = await db.doc(`participants/${uid}`).get();
        const prefs = snap.exists ? snap.data()?.notificationPrefs : null;
        if (isNotificationPrefEnabled(prefs, prefKey)) enabled.push(uid);
      } catch {
        enabled.push(uid);
      }
    })
  );

  return enabled;
}
