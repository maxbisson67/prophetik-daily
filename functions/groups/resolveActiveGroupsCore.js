import { getPlanLimits, readUserPlanTier } from "../subscriptions/planLimits.js";
import { listOwnedGroups } from "./groupOwnership.js";
import { isActiveMembership } from "./groupMembership.js";
import {
  isParticipatingMember,
  listUserMembershipsComprehensive,
  normalizeRole,
  participationAfterDowngrade,
  resolveParticipation,
} from "./participationUtils.js";

/**
 * Logique partagée entre la callable resolveActiveGroups et le script admin.
 */
export async function resolveActiveGroupsForUser(db, uid, keepActiveGroupIds, { now } = {}) {
  const keepIds = [...new Set((keepActiveGroupIds || []).map(String).filter(Boolean))];
  const tier = await readUserPlanTier(db, uid);
  const max = getPlanLimits(tier).activeGroupsLimit;

  if (keepIds.length > max) {
    throw new Error(`TOO_MANY_GROUPS_SELECTED: max=${max}, selected=${keepIds.length}`);
  }

  const memberships = await listUserMembershipsComprehensive(db, uid);
  const ownedGroups = await listOwnedGroups(db, uid);
  const activeMemberships = memberships.filter((row) => isActiveMembership(row.data));
  const membershipGroupIds = new Set(activeMemberships.map((row) => row.groupId));
  const ownedGroupIds = new Set(ownedGroups.map((group) => group.id));

  for (const groupId of keepIds) {
    const known =
      activeMemberships.some((row) => row.groupId === groupId) || ownedGroupIds.has(groupId);
    if (!known) {
      throw new Error(`GROUP_NOT_MEMBER: ${groupId}`);
    }
  }

  const keepSet = new Set(keepIds);
  const timestamp = now || new Date();
  const changes = [];

  activeMemberships.forEach((row) => {
    const role = normalizeRole(row.data.role);
    const selected = keepSet.has(row.groupId);
    const before = resolveParticipation(row.data);
    const nextParticipation = participationAfterDowngrade(role, selected);

    changes.push({
      kind: "membership",
      ref: row.ref,
      groupId: row.groupId,
      role,
      before,
      after: nextParticipation,
      patch: {
        uid: String(row.data.uid || row.data.userId || uid),
        userId: String(row.data.userId || row.data.uid || uid),
        groupId: row.groupId,
        participation: nextParticipation,
        participationChangedAt: timestamp,
        participationChangedReason: "downgrade",
        updatedAt: timestamp,
      },
    });
  });

  ownedGroups.forEach((group) => {
    if (membershipGroupIds.has(group.id)) return;

    const selected = keepSet.has(group.id);
    const nextParticipation = participationAfterDowngrade("owner", selected);
    const ref = db.doc(`group_memberships/${group.id}_${uid}`);

    changes.push({
      kind: "owned_without_membership",
      ref,
      groupId: group.id,
      role: "owner",
      before: null,
      after: nextParticipation,
      patch: {
        groupId: group.id,
        uid,
        userId: uid,
        role: "owner",
        active: true,
        status: "active",
        participation: nextParticipation,
        participationChangedAt: timestamp,
        participationChangedReason: "downgrade",
        updatedAt: timestamp,
      },
    });
  });

  return {
    uid,
    tier,
    max,
    keepIds,
    activeMemberships: activeMemberships.length,
    ownedWithoutMembership: ownedGroups.filter((g) => !membershipGroupIds.has(g.id)).length,
    participatingBefore: activeMemberships.filter((row) => isParticipatingMember(row.data)).length,
    changes,
  };
}

export async function applyResolveActiveGroupsChanges(db, changes, { dryRun = false } = {}) {
  if (dryRun || changes.length === 0) {
    return { updated: changes.length, dryRun };
  }

  const batch = db.batch();
  changes.forEach((change) => {
    batch.set(change.ref, change.patch, { merge: true });
  });
  await batch.commit();
  return { updated: changes.length, dryRun: false };
}
