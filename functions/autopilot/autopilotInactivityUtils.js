import { db, FieldValue, logger } from "../utils.js";
import { sendPushToUsers } from "../utils/pushUtils.js";
import { appYmd, addDaysToYmd } from "../ProphetikDate.js";
import {
  pushTitleWithGroup,
  resolveGroupDisplayName,
} from "../groups/groupDisplayUtils.js";
import { getFirestoreCostFlags } from "../shared/firestoreCostFlags.js";
import {
  groupHadHumanPlayOnYmd,
  recordGroupHumanParticipationYmd,
} from "../groups/groupHumanPlayDenorm.js";

const AI_UID = "ai";
const INACTIVITY_STREAK_THRESHOLD = 3;

export const AUTOPILOT_INACTIVITY_PUSH = {
  title: "Autopilote désactivé",
  body:
    "La création automatique de défis a été désactivée car il n'y a pas d'activités récentes dans le groupe. Pour la réactiver, allez sur le détail du groupe et activez la case Autopilote.",
};

export function buildAutopilotInactivityPush({ groupName } = {}) {
  const name = resolveGroupDisplayName({ name: groupName });
  return {
    title: pushTitleWithGroup(AUTOPILOT_INACTIVITY_PUSH.title, name),
    body: AUTOPILOT_INACTIVITY_PUSH.body,
  };
}

function ymdCompactFromDashed(ymdDashed) {
  return String(ymdDashed || "").replace(/-/g, "");
}

function isActiveGroup(group = {}) {
  if (group?.active === false) return false;
  if (group?.status && String(group.status).toLowerCase() !== "active") return false;
  return true;
}

function resolveOwnerUid(group = {}) {
  const ownerId = group?.ownerId || group?.createdBy || null;
  return ownerId ? String(ownerId) : null;
}

export async function loadDailyChallengesForGroup({ groupId, gameYmdDashed }) {
  const gid = String(groupId);
  const gameYmdCompact = ymdCompactFromDashed(gameYmdDashed);

  const [fgcSnap, tpSnap, tsSnap] = await Promise.all([
    db
      .collection("first_goal_challenges")
      .where("groupId", "==", gid)
      .where("gameYmd", "==", gameYmdDashed)
      .get(),
    db
      .collection("team_prediction_bundles")
      .where("groupId", "==", gid)
      .where("gameYmd", "==", gameYmdCompact)
      .get(),
    db
      .collection("defis")
      .where("groupId", "==", gid)
      .where("gameDate", "==", gameYmdDashed)
      .where("type", "==", 3)
      .get(),
  ]);

  return {
    fgc: fgcSnap.docs,
    tp: tpSnap.docs,
    ts: tsSnap.docs,
    total:
      fgcSnap.size + tpSnap.size + tsSnap.size,
  };
}

export function challengeDocs(challenges) {
  return [...challenges.fgc, ...challenges.tp, ...challenges.ts];
}

export function dayHadDailyChallenges(challenges) {
  return Number(challenges?.total || 0) > 0;
}

export async function dayHadHumanParticipation(challenges) {
  const { count } = await countUniqueHumanParticipants(challenges);
  return count > 0;
}

function entrySubcollectionForChallengeDoc(doc) {
  return doc.ref.parent.id === "defis" ? "participations" : "entries";
}

function humanUidFromEntryDoc(entryDoc) {
  const uid = String(entryDoc.id || entryDoc.data()?.uid || "").trim();
  if (!uid || uid.toLowerCase() === AI_UID) return null;
  return uid;
}

/** Unique human players across SOLO + DUO + TRIO for one group-day. */
export async function countUniqueHumanParticipants(challenges) {
  const uids = new Set();

  for (const doc of challengeDocs(challenges)) {
    const subcollection = entrySubcollectionForChallengeDoc(doc);
    const snap = await doc.ref.collection(subcollection).get();
    for (const entryDoc of snap.docs) {
      const uid = humanUidFromEntryDoc(entryDoc);
      if (uid) uids.add(uid);
    }
  }

  return { count: uids.size, uids };
}

export function getEvaluatedGameYmd(now = new Date()) {
  return addDaysToYmd(appYmd(now), -1);
}

export async function evaluateGroupAutopilotInactivity({
  groupId,
  group,
  evaluatedYmd,
}) {
  const challenges = await loadDailyChallengesForGroup({
    groupId,
    gameYmdDashed: evaluatedYmd,
  });

  if (!dayHadDailyChallenges(challenges)) {
    return {
      action: "skip",
      reason: "NO_DAILY_CHALLENGES",
      evaluatedYmd,
      streak: Number(group?.autopilotInactivityDays || 0),
    };
  }

  let hadParticipation = false;
  let participationSource = "legacy_scan";
  const { autopilotInactivityUseDenorm } = getFirestoreCostFlags();
  const denormHadPlay = groupHadHumanPlayOnYmd(group, evaluatedYmd);

  if (autopilotInactivityUseDenorm && denormHadPlay !== null) {
    hadParticipation = denormHadPlay;
    participationSource = "denorm";
  } else {
    hadParticipation = await dayHadHumanParticipation(challenges);
    participationSource = "legacy_scan";
    if (hadParticipation) {
      await recordGroupHumanParticipationYmd(db, groupId, evaluatedYmd);
    }
  }

  const previousStreak = Number(group?.autopilotInactivityDays || 0);
  const nextStreak = hadParticipation ? 0 : previousStreak + 1;

  if (hadParticipation) {
    if (previousStreak > 0) {
      await db.collection("groups").doc(String(groupId)).set(
        {
          autopilotInactivityDays: 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      action: "reset",
      reason: "PARTICIPATION",
      evaluatedYmd,
      streak: 0,
      challengeCount: challenges.total,
      participationSource,
    };
  }

  if (nextStreak < INACTIVITY_STREAK_THRESHOLD) {
    await db.collection("groups").doc(String(groupId)).set(
      {
        autopilotInactivityDays: nextStreak,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      action: "increment",
      reason: "NO_PARTICIPATION",
      evaluatedYmd,
      streak: nextStreak,
      challengeCount: challenges.total,
      participationSource,
    };
  }

  const ownerUid = resolveOwnerUid(group);
  const groupRef = db.collection("groups").doc(String(groupId));

  await groupRef.set(
    {
      autopilotEnabled: false,
      autopilotInactivityDays: 0,
      autopilotDisabledReason: "inactive_3_days",
      autopilotDisabledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  let pushResult = { ok: false, reason: "NO_OWNER" };

  if (ownerUid) {
    const groupName = resolveGroupDisplayName(group);
    const pushCopy = buildAutopilotInactivityPush({ groupName });

    try {
      pushResult = await sendPushToUsers({
        uids: [ownerUid],
        title: pushCopy.title,
        body: pushCopy.body,
        data: {
          action: "OPEN_GROUP_DETAIL",
          groupId: String(groupId),
          reason: "autopilot_inactivity",
        },
        channelId: "challenges_v2",
        logTag: "autopilotInactivity",
      });
    } catch (err) {
      logger.warn("[autopilotInactivity] owner push failed", {
        groupId,
        ownerUid,
        error: err?.message || String(err),
      });
      pushResult = { ok: false, error: String(err?.message || err) };
    }
  }

  logger.info("[autopilotInactivity] autopilot disabled", {
    groupId,
    evaluatedYmd,
    streak: nextStreak,
    ownerUid,
    pushResult,
  });

  return {
    action: "disabled",
    reason: "INACTIVE_3_DAYS",
    evaluatedYmd,
    streak: nextStreak,
    challengeCount: challenges.total,
    ownerUid,
    pushResult,
  };
}

export async function runAutopilotInactivityCheck(forDate = new Date()) {
  const evaluatedYmd = getEvaluatedGameYmd(forDate);

  const stats = {
    evaluatedYmd,
    groups: 0,
    skippedNoChallenges: 0,
    reset: 0,
    incremented: 0,
    disabled: 0,
    errors: 0,
  };

  const groupsSnap = await db
    .collection("groups")
    .where("autopilotEnabled", "==", true)
    .limit(500)
    .get();

  stats.groups = groupsSnap.size;

  for (const groupDoc of groupsSnap.docs) {
    const groupId = groupDoc.id;
    const group = groupDoc.data() || {};

    if (!isActiveGroup(group)) continue;

    try {
      const result = await evaluateGroupAutopilotInactivity({
        groupId,
        group,
        evaluatedYmd,
      });

      if (result.action === "skip") stats.skippedNoChallenges += 1;
      if (result.action === "reset") stats.reset += 1;
      if (result.action === "increment") stats.incremented += 1;
      if (result.action === "disabled") stats.disabled += 1;
    } catch (err) {
      stats.errors += 1;
      logger.warn("[autopilotInactivity] group failed", {
        groupId,
        evaluatedYmd,
        error: err?.message || String(err),
      });
    }
  }

  logger.info("[autopilotInactivity] done", stats);
  return stats;
}

export { INACTIVITY_STREAK_THRESHOLD, isActiveGroup };
