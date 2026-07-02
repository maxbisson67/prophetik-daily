import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { sendPushToUsers } from "../utils/pushUtils.js";
import { resolveGroupDisplayName } from "../groups/groupDisplayUtils.js";
import {
  computeMemberSeasonRank,
  fetchActiveMemberUids,
} from "../leaderboard/leaderboardRankUtils.js";
import { NOTIFICATION_PREF_KEYS } from "./notificationPrefs.js";
import { buildLeaderboardRankUpPush } from "./leaderboardRankMessages.js";

const db = getFirestore();

function normalizeLang(lang) {
  return String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

async function getParticipantLang(uid) {
  try {
    const snap = await db.doc(`participants/${uid}`).get();
    return normalizeLang(snap.data()?.appLang);
  } catch {
    return "fr";
  }
}

function rankStateRef(groupId, seasonId, uid) {
  return db.doc(
    `participants/${uid}/leaderboardRankState/${String(groupId)}_${String(seasonId)}`
  );
}

/**
 * Envoie une push si le rang saison s'améliore (nombre plus petit = mieux).
 * @param {number} previousRank — rang immédiatement avant le crédit de points.
 */
export async function maybeNotifyLeaderboardRankUp({
  groupId,
  seasonId,
  uid,
  previousRank,
}) {
  const gid = String(groupId || "").trim();
  const sid = String(seasonId || "").trim();
  const userId = String(uid || "").trim();
  const beforeRank = Number(previousRank);

  if (!gid || !sid || !userId || userId.toLowerCase() === "ai") {
    return { ok: true, skipped: true, reason: "invalid-input" };
  }

  if (!Number.isFinite(beforeRank) || beforeRank < 1) {
    return { ok: true, skipped: true, reason: "missing-previous-rank" };
  }

  const memberUids = await fetchActiveMemberUids(gid);
  if (memberUids.length < 2) {
    return { ok: true, skipped: true, reason: "single-member-group" };
  }

  const afterRank = await computeMemberSeasonRank({
    groupId: gid,
    seasonId: sid,
    uid: userId,
    memberUids,
  });

  if (!Number.isFinite(afterRank) || afterRank < 1) {
    return { ok: true, skipped: true, reason: "no-after-rank", beforeRank };
  }

  await rankStateRef(gid, sid, userId).set(
    {
      groupId: gid,
      seasonId: sid,
      lastRank: afterRank,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (afterRank >= beforeRank) {
    return {
      ok: true,
      skipped: true,
      reason: "no-improvement",
      beforeRank,
      afterRank,
    };
  }

  const lang = await getParticipantLang(userId);
  let groupName = null;
  try {
    const groupSnap = await db.doc(`groups/${gid}`).get();
    groupName = resolveGroupDisplayName(groupSnap.data() || {});
  } catch {
    // optional
  }

  const { title, body } = buildLeaderboardRankUpPush({
    lang,
    groupName,
    previousRank: beforeRank,
    newRank: afterRank,
  });

  const pushRes = await sendPushToUsers({
    uids: [userId],
    title,
    body,
    data: {
      action: "OPEN_LEADERBOARD",
      groupId: gid,
      seasonId: sid,
      previousRank: String(beforeRank),
      newRank: String(afterRank),
    },
    channelId: "challenges_v2",
    logTag: "leaderboardRankUp",
    notificationPrefKey: NOTIFICATION_PREF_KEYS.LEADERBOARD_RANK_UP,
  });

  logger.info("[leaderboardRankUp] done", {
    groupId: gid,
    seasonId: sid,
    uid: userId,
    beforeRank,
    afterRank,
    recipients: pushRes?.recipients || 0,
  });

  return { ok: true, sent: (pushRes?.recipients || 0) > 0, beforeRank, afterRank };
}

export async function notifyLeaderboardRankUpAfterPointsCredit({
  groupId,
  seasonId,
  uid,
  previousRank,
  pointsAdded = 0,
}) {
  const pts = Number(pointsAdded) || 0;
  if (pts <= 0) {
    return { ok: true, skipped: true, reason: "no-points-added" };
  }

  return maybeNotifyLeaderboardRankUp({
    groupId,
    seasonId,
    uid,
    previousRank,
  });
}
