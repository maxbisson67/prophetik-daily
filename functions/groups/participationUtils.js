import { isActiveMembership } from "./groupMembership.js";

export const PARTICIPATION = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ADMIN_ONLY: "admin_only",
};

export function normalizeRole(role) {
  const r = String(role || "member").toLowerCase();
  if (r === "owner" || r === "admin") return r;
  return "member";
}

/** @returns {'active'|'inactive'|'admin_only'} */
export function resolveParticipation(m = {}) {
  const raw = String(m?.participation || "").toLowerCase();
  if (raw === PARTICIPATION.ACTIVE) return PARTICIPATION.ACTIVE;
  if (raw === PARTICIPATION.INACTIVE) return PARTICIPATION.INACTIVE;
  if (raw === PARTICIPATION.ADMIN_ONLY) return PARTICIPATION.ADMIN_ONLY;
  if (isActiveMembership(m)) return PARTICIPATION.ACTIVE;
  return PARTICIPATION.INACTIVE;
}

export function canManageGroup(m = {}) {
  if (!isActiveMembership(m)) return false;
  const role = normalizeRole(m.role);
  return role === "owner" || role === "admin";
}

export function isParticipatingMember(m = {}) {
  return isActiveMembership(m) && resolveParticipation(m) === PARTICIPATION.ACTIVE;
}

/** Membre encore dans le groupe — peut basculer participation (même si active:false legacy). */
export function isMembershipEligibleForParticipationChange(m = {}) {
  const st = String(m?.status || "").toLowerCase();
  if (["archived", "deleted", "left"].includes(st)) return false;
  if (isActiveMembership(m)) return true;

  const part = String(m?.participation || "").toLowerCase();
  if (part === PARTICIPATION.INACTIVE || part === PARTICIPATION.ADMIN_ONLY) {
    return true;
  }

  if (st === "inactive" || m?.active === false) {
    return true;
  }

  return false;
}

export function isValidParticipationForRole(role, participation) {
  const r = normalizeRole(role);
  const p = String(participation || "").toLowerCase();
  if (p === PARTICIPATION.ACTIVE) return true;
  if (p === PARTICIPATION.ADMIN_ONLY) return r === "owner" || r === "admin";
  if (p === PARTICIPATION.INACTIVE) return r === "member";
  return false;
}

export function participationAfterDowngrade(role, selected) {
  const r = normalizeRole(role);
  if (selected) return PARTICIPATION.ACTIVE;
  if (r === "owner" || r === "admin") return PARTICIPATION.ADMIN_ONLY;
  return PARTICIPATION.INACTIVE;
}

function membershipDocToRow(doc) {
  const data = doc.data() || {};
  const groupId = String(data.groupId || doc.id.split("_")[0] || "").trim();
  return { id: doc.id, ref: doc.ref, data, groupId };
}

/** Tous les docs membership d'un user (uid, userId ou participantId legacy). */
export async function listUserMembershipsComprehensive(db, uid) {
  const id = String(uid);
  const [byUid, byUserId, byParticipantId] = await Promise.all([
    db.collection("group_memberships").where("uid", "==", id).get(),
    db.collection("group_memberships").where("userId", "==", id).get(),
    db.collection("group_memberships").where("participantId", "==", id).get(),
  ]);

  const map = new Map();
  for (const snap of [byUid, byUserId, byParticipantId]) {
    snap.docs.forEach((doc) => {
      map.set(doc.id, membershipDocToRow(doc));
    });
  }

  return Array.from(map.values());
}

export async function listUserMemberships(db, uid) {
  return listUserMembershipsComprehensive(db, uid);
}

export async function countActiveParticipations(db, uid) {
  const rows = await listUserMemberships(db, uid);
  return rows.filter((row) => isParticipatingMember(row.data)).length;
}

export async function getMembership(db, groupId, uid) {
  const row = await resolveMembershipForUser(db, groupId, uid);
  return row || null;
}

/** Trouve le doc membership le plus pertinent (canonical, uid, userId, participantId). */
export async function resolveMembershipForUser(db, groupId, uid) {
  const gid = String(groupId || "").trim();
  const id = String(uid || "").trim();
  if (!gid || !id) return null;

  const canonicalRef = db.doc(`group_memberships/${gid}_${id}`);
  const canonicalSnap = await canonicalRef.get();

  const rows = (await listUserMembershipsComprehensive(db, id)).filter(
    (row) => row.groupId === gid
  );

  const pickBest = (candidates) => {
    if (!candidates.length) return null;

    const active = candidates.find((row) => isActiveMembership(row.data));
    if (active) return active;

    const downgraded = candidates.find((row) =>
      isMembershipEligibleForParticipationChange(row.data)
    );
    if (downgraded) return downgraded;

    return candidates[0];
  };

  if (rows.length > 0) {
    return pickBest(rows);
  }

  if (canonicalSnap.exists) {
    return membershipDocToRow(canonicalSnap);
  }

  return null;
}
