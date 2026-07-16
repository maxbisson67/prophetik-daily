/** Propriétaire actuel du groupe (ownerId après transfert; createdBy seulement en repli legacy). */
export function resolveGroupOwnerUid(group) {
  const ownerId = String(group?.ownerId || "").trim();
  if (ownerId) return ownerId;
  return String(group?.createdBy || "").trim() || null;
}

export function isGroupOwner(group, uid) {
  if (!group || !uid) return false;
  return resolveGroupOwnerUid(group) === String(uid);
}

/** Groupe visible dans l'app (exclut archivés / supprimés). */
export function isActiveGroup(group) {
  if (!group) return false;
  if (group.active === false) return false;
  const status = String(group.status || "active").toLowerCase();
  return status !== "archived" && status !== "deleted";
}

/** Membership encore valide pour lister un groupe. */
export function isActiveMembership(m) {
  const st = String(m?.status || "").toLowerCase();
  if (["archived", "deleted", "left"].includes(st)) return false;
  if (st) return ["open", "active", "approved"].includes(st);
  return m?.active !== false;
}
