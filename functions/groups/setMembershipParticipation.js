import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "../utils.js";
import { getPlanLimits, readUserPlanTier, normalizePlanTier } from "../subscriptions/planLimits.js";
import { throwActiveGroupLimitReached } from "./participationEnforcement.js";
import {
  isParticipatingMember,
  isMembershipEligibleForParticipationChange,
  isValidParticipationForRole,
  listUserMembershipsComprehensive,
  normalizeRole,
  PARTICIPATION,
  participationAfterDowngrade,
  resolveMembershipForUser,
  resolveParticipation,
} from "./participationUtils.js";

/**
 * Bascule manuelle de participation (ex. Free : jouer dans un autre groupe).
 * Si passage à active avec plafond déjà atteint (Free), les autres participations actives sont rétrogradées.
 * Si des slots restent (ex. passage Free → Pro), activation sans rétrograder les autres groupes.
 */
export const setMembershipParticipation = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

  const groupId = String(req.data?.groupId || "").trim();
  const nextParticipation = String(req.data?.participation || "").toLowerCase();

  if (!groupId) throw new HttpsError("invalid-argument", "groupId required");
  if (!Object.values(PARTICIPATION).includes(nextParticipation)) {
    throw new HttpsError("invalid-argument", "Invalid participation");
  }

  const canonicalRef = db.doc(`group_memberships/${groupId}_${uid}`);
  let membershipRow = await resolveMembershipForUser(db, groupId, uid);
  let bootstrapOwnerMembership = false;

  if (!membershipRow) {
    const groupSnap = await db.doc(`groups/${groupId}`).get();
    if (!groupSnap.exists) {
      throw new HttpsError("not-found", "Membership not found");
    }

    const group = groupSnap.data() || {};
    const ownerId = String(group.ownerId || group.createdBy || "").trim();
    if (ownerId !== String(uid)) {
      throw new HttpsError("not-found", "Membership not found");
    }

    bootstrapOwnerMembership = true;
    membershipRow = {
      id: `${groupId}_${uid}`,
      ref: canonicalRef,
      groupId,
      data: {
        role: "owner",
        active: true,
        status: "active",
        participation: PARTICIPATION.ADMIN_ONLY,
      },
    };
  } else if (!isMembershipEligibleForParticipationChange(membershipRow.data)) {
    throw new HttpsError("failed-precondition", "Membership not active");
  }

  const membership = membershipRow.data || {};
  const membershipRef = membershipRow.ref;
  const role = normalizeRole(membership.role);

  if (!isValidParticipationForRole(role, nextParticipation)) {
    throw new HttpsError("invalid-argument", "Invalid participation for role");
  }

  const previousParticipation = bootstrapOwnerMembership
    ? PARTICIPATION.ADMIN_ONLY
    : resolveParticipation(membership);
  if (previousParticipation === nextParticipation) {
    return {
      ok: true,
      groupId,
      participation: nextParticipation,
      previousParticipation,
    };
  }

  const tier = await readUserPlanTier(db, uid);
  const normalizedTier = normalizePlanTier(tier);
  const max = getPlanLimits(normalizedTier).activeGroupsLimit;
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  if (nextParticipation === PARTICIPATION.ACTIVE) {
    const rows = await listUserMembershipsComprehensive(db, uid);
    const otherActiveRows = rows.filter((row) => {
      if (row.groupId === groupId) return false;
      return isParticipatingMember(row.data);
    });
    const otherActiveCount = otherActiveRows.length;

    if (otherActiveCount >= max) {
      if (max <= 1) {
        otherActiveRows.forEach((row) => {
          const otherRole = normalizeRole(row.data.role);
          const demoted = participationAfterDowngrade(otherRole, false);
          batch.set(
            row.ref,
            {
              participation: demoted,
              participationChangedAt: now,
              participationChangedReason: "user_switch",
              updatedAt: now,
            },
            { merge: true }
          );
        });
      } else {
        throwActiveGroupLimitReached({
          tier: normalizedTier,
          current: otherActiveCount,
          max,
        });
      }
    }
  }

  const participationPatch = {
    participation: nextParticipation,
    participationChangedAt: now,
    participationChangedReason: "user_switch",
    updatedAt: now,
  };

  if (nextParticipation === PARTICIPATION.ACTIVE) {
    participationPatch.active = true;
    participationPatch.status = "active";
  }

  if (bootstrapOwnerMembership) {
    batch.set(
      membershipRef,
      {
        groupId,
        uid,
        userId: uid,
        role: "owner",
        active: true,
        status: "active",
        ...participationPatch,
        createdAt: now,
      },
      { merge: true }
    );
  } else {
    batch.set(membershipRef, participationPatch, { merge: true });
  }

  if (membershipRef.path !== canonicalRef.path) {
    batch.set(
      canonicalRef,
      {
        groupId,
        uid,
        userId: uid,
        role,
        ...participationPatch,
      },
      { merge: true }
    );
  }

  await batch.commit();

  return {
    ok: true,
    groupId,
    participation: nextParticipation,
    previousParticipation,
  };
});
