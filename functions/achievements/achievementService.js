/**
 * Progression globale participant : stats, streak, badges MVP.
 * Toutes les écritures passent par l'Admin SDK (Cloud Functions).
 */
import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue, logger } from "../utils.js";
import { appYmd, addDaysToYmd } from "../ProphetikDate.js";
import {
  buildDefaultParticipantAchievements,
  mergeParticipantStats,
  normalizeParticipantAchievements,
  PARTICIPATION_DATE_TZ,
  STAT_KEYS,
} from "./participantProgressionModel.js";
import { MVP_ACHIEVEMENT_DEFINITIONS } from "./achievementDefinitions.js";

function participantRef(uid) {
  return db.doc(`participants/${String(uid)}`);
}

function eventsRef(uid) {
  return participantRef(uid).collection("events");
}

export function participationDateToronto(inputDate = new Date()) {
  return appYmd(inputDate);
}

function yesterdayYmd(todayYmd) {
  return addDaysToYmd(todayYmd, -1);
}

/**
 * @param {Record<string, any>} stats
 * @param {string} participationDate YYYY-MM-DD
 */
export function computeStreakUpdate(stats, participationDate) {
  const today = String(participationDate || "").trim();
  const last = stats?.[STAT_KEYS.LAST_PARTICIPATION_DATE]
    ? String(stats[STAT_KEYS.LAST_PARTICIPATION_DATE])
    : null;

  let currentStreak = Number(stats?.[STAT_KEYS.CURRENT_STREAK] || 0);
  let bestStreak = Number(stats?.[STAT_KEYS.BEST_STREAK] || 0);
  let lastParticipationDate = last;
  let changed = false;

  if (!today) {
    return { currentStreak, bestStreak, lastParticipationDate, changed };
  }

  if (!last) {
    currentStreak = 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    lastParticipationDate = today;
    changed = true;
    return { currentStreak, bestStreak, lastParticipationDate, changed };
  }

  if (last === today) {
    return { currentStreak, bestStreak, lastParticipationDate, changed: false };
  }

  if (last === yesterdayYmd(today)) {
    currentStreak = Math.max(1, currentStreak) + 1;
  } else {
    currentStreak = 1;
  }

  bestStreak = Math.max(bestStreak, currentStreak);
  lastParticipationDate = today;
  changed = true;

  return { currentStreak, bestStreak, lastParticipationDate, changed };
}

/**
 * @param {Record<string, any>} stats
 * @param {{
 *   countParticipation?: boolean,
 *   isCorrectPrediction?: boolean,
 *   isExactScore?: boolean,
 *   isFGCWin?: boolean,
 *   tsPoints?: number,
 *   participationDate?: string,
 * }} context
 */
export function applyParticipationStatsDelta(stats, context = {}) {
  const next = { ...stats };

  if (context.countParticipation !== false) {
    next[STAT_KEYS.TOTAL_PARTICIPATIONS] =
      Number(next[STAT_KEYS.TOTAL_PARTICIPATIONS] || 0) + 1;

    const participationDate =
      context.participationDate || participationDateToronto(new Date());
    const streak = computeStreakUpdate(next, participationDate);
    if (streak.changed) {
      next[STAT_KEYS.CURRENT_STREAK] = streak.currentStreak;
      next[STAT_KEYS.BEST_STREAK] = streak.bestStreak;
      next[STAT_KEYS.LAST_PARTICIPATION_DATE] = streak.lastParticipationDate;
    }
  }

  if (context.isCorrectPrediction) {
    next[STAT_KEYS.TOTAL_CORRECT_PREDICTIONS] =
      Number(next[STAT_KEYS.TOTAL_CORRECT_PREDICTIONS] || 0) + 1;
  }

  if (context.isExactScore) {
    next[STAT_KEYS.EXACT_SCORES] = Number(next[STAT_KEYS.EXACT_SCORES] || 0) + 1;
  }

  if (context.isFGCWin) {
    next[STAT_KEYS.FGC_WINS] = Number(next[STAT_KEYS.FGC_WINS] || 0) + 1;
  }

  const tsPoints = Number(context.tsPoints);
  if (Number.isFinite(tsPoints) && tsPoints >= 5) {
    next[STAT_KEYS.TS_FIVE_POINT_NIGHTS] =
      Number(next[STAT_KEYS.TS_FIVE_POINT_NIGHTS] || 0) + 1;
  }

  return next;
}

export function buildParticipantProgressionPatch(data = {}) {
  const patch = {};
  const currentStats = data?.stats;
  const mergedStats = mergeParticipantStats(currentStats);

  const statsNeedsWrite =
    !currentStats ||
    typeof currentStats !== "object" ||
    Object.values(STAT_KEYS).some((key) => currentStats[key] === undefined);

  if (statsNeedsWrite) {
    patch.stats = mergedStats;
  }

  const currentAchievements = data?.achievements;
  const achievementsNeedsWrite =
    currentAchievements === undefined ||
    currentAchievements === null ||
    typeof currentAchievements !== "object" ||
    Array.isArray(currentAchievements);

  if (achievementsNeedsWrite) {
    patch.achievements = normalizeParticipantAchievements(currentAchievements);
  }

  if (!Object.keys(patch).length) {
    return null;
  }

  patch.updatedAt = FieldValue.serverTimestamp();
  return patch;
}

export async function ensureParticipantProgressionFields(uid, opts = {}) {
  const pk = String(uid || "").trim();
  if (!pk) return { ok: false, initialized: false, reason: "missing-uid" };

  const ref = opts.participantRef || participantRef(pk);

  const apply = async (tx) => {
    const snap = opts.participantSnap || (await tx.get(ref));
    if (!snap.exists) {
      return { ok: false, initialized: false, reason: "missing-participant" };
    }

    const data = snap.data() || {};
    const patch = buildParticipantProgressionPatch(data);

    if (!patch) {
      return { ok: true, initialized: false, fields: [] };
    }

    const { updatedAt, ...fields } = patch;
    tx.set(ref, patch, { merge: true });

    return {
      ok: true,
      initialized: true,
      fields: Object.keys(fields),
    };
  };

  if (opts.tx) {
    return apply(opts.tx);
  }

  const result = await db.runTransaction(apply);

  if (result?.initialized) {
    logger.info("[achievements] progression fields ensured", {
      uid: pk,
      fields: result.fields,
    });
  }

  return result;
}

/**
 * @returns {string[]} achievementIds newly unlocked
 */
export function evaluateAchievements(stats, achievements = {}) {
  const unlockedIds = [];

  for (const def of MVP_ACHIEVEMENT_DEFINITIONS) {
    if (achievements?.[def.id]?.unlocked === true) continue;

    const current = Number(stats?.[def.statKey] ?? 0);
    if (Number.isFinite(current) && current >= Number(def.threshold || 0)) {
      unlockedIds.push(def.id);
    }
  }

  return unlockedIds;
}

/**
 * @param {import('firebase-admin/firestore').Transaction} tx
 */
export function unlockAchievementTx({ tx, uid, achievementId, achievements, nowTs }) {
  const id = String(achievementId || "").trim();
  if (!id) return { unlocked: false, reason: "missing-id" };

  if (achievements?.[id]?.unlocked === true) {
    return { unlocked: false, reason: "already-unlocked" };
  }

  const unlockedAt = nowTs || Timestamp.now();
  achievements[id] = {
    unlocked: true,
    unlockedAt,
  };

  const eventRef = eventsRef(uid).doc(`badge_${id}`);
  tx.set(
    eventRef,
    {
      type: "badge_unlocked",
      badgeId: id,
      createdAt: unlockedAt,
      read: false,
    },
    { merge: false }
  );

  return { unlocked: true, achievementId: id, unlockedAt };
}

/**
 * @param {import('firebase-admin/firestore').Transaction} tx
 */
export function updateParticipationStatsTx({ tx, ref, snap, context }) {
  const data = snap.data() || {};
  const stats = mergeParticipantStats(data.stats);
  const achievements = normalizeParticipantAchievements(data.achievements);

  const nextStats = applyParticipationStatsDelta(stats, context);
  const newlyUnlocked = evaluateAchievements(nextStats, achievements);

  for (const achievementId of newlyUnlocked) {
    unlockAchievementTx({
      tx,
      uid: ref.id,
      achievementId,
      achievements,
    });
  }

  tx.set(
    ref,
    {
      stats: nextStats,
      achievements,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    stats: nextStats,
    newlyUnlocked,
  };
}

export async function updateParticipationStats(uid, context = {}, opts = {}) {
  const pk = String(uid || "").trim();
  if (!pk) return { ok: false, reason: "missing-uid" };

  const ref = opts.participantRef || participantRef(pk);

  const run = async (tx) => {
    const snap = opts.participantSnap || (await tx.get(ref));
    if (!snap.exists) return { ok: false, reason: "missing-participant" };

    // mergeParticipantStats / normalizeParticipantAchievements inside
    // updateParticipationStatsTx already apply defaults — no mid-tx write+re-read.
    return updateParticipationStatsTx({
      tx,
      ref,
      snap,
      context,
    });
  };

  if (opts.tx) return run(opts.tx);
  return db.runTransaction(run);
}

export async function updateParticipantStreak(uid, participationDate, opts = {}) {
  return updateParticipationStats(
    uid,
    {
      countParticipation: true,
      participationDate: participationDate || participationDateToronto(new Date()),
      isCorrectPrediction: false,
      isExactScore: false,
      isFGCWin: false,
    },
    opts
  );
}

export async function evaluateAchievementsForUid(uid, opts = {}) {
  const pk = String(uid || "").trim();
  if (!pk) return { ok: false, reason: "missing-uid", newlyUnlocked: [] };

  const ref = participantRef(pk);

  const run = async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "missing-participant", newlyUnlocked: [] };

    const data = snap.data() || {};
    const stats = mergeParticipantStats(data.stats);
    const achievements = normalizeParticipantAchievements(data.achievements);
    const newlyUnlocked = evaluateAchievements(stats, achievements);

    if (!newlyUnlocked.length) {
      return { ok: true, newlyUnlocked: [] };
    }

    for (const achievementId of newlyUnlocked) {
      unlockAchievementTx({ tx, uid: pk, achievementId, achievements });
    }

    tx.set(
      ref,
      {
        achievements,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true, newlyUnlocked };
  };

  if (opts.tx) return run(opts.tx);
  return db.runTransaction(run);
}

export async function unlockAchievement(uid, achievementId, opts = {}) {
  const pk = String(uid || "").trim();
  const id = String(achievementId || "").trim();
  if (!pk || !id) return { ok: false, reason: "missing-args" };

  const ref = participantRef(pk);

  const run = async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "missing-participant" };

    const data = snap.data() || {};
    const achievements = normalizeParticipantAchievements(data.achievements);
    const result = unlockAchievementTx({ tx, uid: pk, achievementId: id, achievements });

    if (result.unlocked) {
      tx.set(
        ref,
        {
          achievements,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return { ok: true, ...result };
  };

  if (opts.tx) return run(opts.tx);
  return db.runTransaction(run);
}

/**
 * Point d'entrée unique pour stats + streak + badges.
 */
export async function recordParticipantProgression(uid, context = {}) {
  const result = await updateParticipationStats(uid, context);

  if (result?.newlyUnlocked?.length) {
    logger.info("[achievements] unlocked", {
      uid: String(uid),
      badges: result.newlyUnlocked,
      challengeType: context.challengeType || null,
    });
  }

  return result;
}

export async function recordParticipantProgressionSafe(uid, context = {}) {
  try {
    return await recordParticipantProgression(uid, context);
  } catch (e) {
    logger.warn("[achievements] record failed", {
      uid: String(uid || ""),
      challengeType: context?.challengeType || null,
      err: String(e?.message || e),
      code: e?.code || null,
    });
    return { ok: false, err: String(e?.message || e) };
  }
}

export {
  buildDefaultParticipantAchievements,
  buildDefaultParticipantStats,
  mergeParticipantStats,
  normalizeParticipantAchievements,
  PARTICIPATION_DATE_TZ,
  STAT_KEYS,
} from "./participantProgressionModel.js";
