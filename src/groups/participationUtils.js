import { isActiveMembership } from "@src/groups/groupOwnership";

export const PARTICIPATION = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ADMIN_ONLY: "admin_only",
};

/** Nova (uid `ai`, type `ai`) — pas un participant humain pour les stats / limites. */
export function isNovaMember(m = {}, uidOverride = "") {
  const u = String(uidOverride || m.uid || m.userId || m.participantId || "").toLowerCase();
  if (u === "ai") return true;
  if (String(m.type || "").toLowerCase() === "ai") return true;
  return false;
}

export function resolveParticipation(m = {}) {
  const raw = String(m?.participation || "").toLowerCase();
  if (raw === PARTICIPATION.ACTIVE) return PARTICIPATION.ACTIVE;
  if (raw === PARTICIPATION.INACTIVE) return PARTICIPATION.INACTIVE;
  if (raw === PARTICIPATION.ADMIN_ONLY) return PARTICIPATION.ADMIN_ONLY;
  if (isActiveMembership(m)) return PARTICIPATION.ACTIVE;
  return PARTICIPATION.INACTIVE;
}

export function isParticipatingMember(m = {}) {
  return isActiveMembership(m) && resolveParticipation(m) === PARTICIPATION.ACTIVE;
}

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
