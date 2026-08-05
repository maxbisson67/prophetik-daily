import { HttpsError } from "firebase-functions/v2/https";
import { getPlanLimits, normalizePlanTier } from "../subscriptions/planLimits.js";
import {
  countActiveParticipations,
  getMembership,
  isParticipatingMember,
  listUserMembershipsComprehensive,
  PARTICIPATION,
} from "./participationUtils.js";

export function throwActiveGroupLimitReached({ tier, current, max }) {
  throw new HttpsError("failed-precondition", "ACTIVE_GROUP_LIMIT_REACHED", {
    tier,
    current,
    max,
  });
}

export function throwActiveGroupResolutionRequired({ tier, current, max }) {
  throw new HttpsError("failed-precondition", "ACTIVE_GROUP_RESOLUTION_REQUIRED", {
    tier,
    current,
    max,
  });
}

export function throwParticipationRequired() {
  throw new HttpsError("failed-precondition", "PARTICIPATION_ACTIVE_REQUIRED", {
    reason: "PARTICIPATION_ACTIVE_REQUIRED",
  });
}

export function isActiveParticipationOverLimit(activeCount, tier) {
  const max = getPlanLimits(tier).activeGroupsLimit;
  return activeCount > max;
}

export async function assertCanSetParticipationActive(db, uid, tier, { exemptGroupId } = {}) {
  const normalizedTier = normalizePlanTier(tier);
  const max = getPlanLimits(normalizedTier).activeGroupsLimit;
  const rows = await listUserMembershipsComprehensive(db, uid);

  let current = 0;
  rows.forEach((row) => {
    const m = row.data || {};
    if (!isParticipatingMember(m)) return;
    const gid = row.groupId;
    if (exemptGroupId && gid === String(exemptGroupId)) return;
    current += 1;
  });

  if (current >= max) {
    throwActiveGroupLimitReached({ tier: normalizedTier, current, max });
  }

  return { tier: normalizedTier, current, max };
}

export async function assertCanParticipateInGroup(db, groupId, uid) {
  const membership = await getMembership(db, groupId, uid);
  if (!membership || !isParticipatingMember(membership.data)) {
    throwParticipationRequired();
  }
  return membership;
}

export function initialOwnerParticipation(activeCount, tier) {
  const max = getPlanLimits(tier).activeGroupsLimit;
  return activeCount < max ? PARTICIPATION.ACTIVE : PARTICIPATION.ADMIN_ONLY;
}
