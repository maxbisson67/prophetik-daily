/** Membership actif — aligné avec src/groups/groupOwnership.js (app mobile). */
export function isActiveMembership(m = {}) {
  const st = String(m?.status || "").toLowerCase();
  if (["archived", "deleted", "left"].includes(st)) return false;
  if (st) return ["open", "active", "approved"].includes(st);
  return m?.active !== false;
}

export {
  PARTICIPATION,
  canManageGroup,
  isParticipatingMember,
  resolveParticipation,
} from "./participationUtils.js";
