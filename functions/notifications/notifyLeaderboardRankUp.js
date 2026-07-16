import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  computeMemberSeasonRank,
  fetchActiveMemberUids,
} from "../leaderboard/leaderboardRankUtils.js";
import { NOTIFICATION_PREF_KEYS } from "./notificationPrefs.js";
import { buildLeaderboardRankUpPush } from "./leaderboardRankMessages.js";
import {
  fetchGroupName,
  loadParticipantDisplayNames,
  sendGroupPushByLang,
} from "./notificationUtils.js";

const db = getFirestore();

function rankStateRef(groupId, seasonId, uid) {
  return db.doc(
    `participants/${uid}/leaderboardRankState/${String(groupId)}_${String(seasonId)}`
  );
}

const TOP_RANK_THRESHOLD = 3;

/**
 * Envoie une push au groupe si le rang saison s'améliore dans le top 3.
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

  const stateRef = rankStateRef(gid, sid, userId);
  const stateSnap = await stateRef.get();
  const prevState = stateSnap.data() || {};

  await stateRef.set(
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

  if (afterRank > TOP_RANK_THRESHOLD) {
    return {
      ok: true,
      skipped: true,
      reason: "outside-top-3",
      beforeRank,
      afterRank,
    };
  }

  if (Number(prevState.lastGroupBroadcastRank) === afterRank) {
    return {
      ok: true,
      skipped: true,
      reason: "already-broadcast-for-rank",
      beforeRank,
      afterRank,
    };
  }

  const nameByUid = await loadParticipantDisplayNames([userId]);
  const memberName = nameByUid.get(userId) || userId;
  const groupName = await fetchGroupName(gid);

  const pushRes = await sendGroupPushByLang({
    groupId: gid,
    buildMessage: (lang) =>
      buildLeaderboardRankUpPush({
        lang,
        groupName,
        memberName,
        newRank: afterRank,
      }),
    data: {
      action: "OPEN_LEADERBOARD",
      groupId: gid,
      seasonId: sid,
      previousRank: String(beforeRank),
      newRank: String(afterRank),
      uid: userId,
    },
    channelId: "challenges_v2",
    logTag: "leaderboardRankUp",
    notificationPrefKey: NOTIFICATION_PREF_KEYS.LEADERBOARD_RANK_UP,
  });

  if (pushRes?.sent > 0) {
    await stateRef.set(
      {
        lastGroupBroadcastRank: afterRank,
        lastGroupBroadcastAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  logger.info("[leaderboardRankUp] done", {
    groupId: gid,
    seasonId: sid,
    uid: userId,
    beforeRank,
    afterRank,
    sent: pushRes?.sent || 0,
    recipients: pushRes?.recipients || 0,
  });

  return {
    ok: true,
    sent: (pushRes?.sent || 0) > 0,
    beforeRank,
    afterRank,
  };
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
