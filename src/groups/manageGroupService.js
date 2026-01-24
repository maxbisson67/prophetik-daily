// src/groups/manageGroupService.js
import functions from "@react-native-firebase/functions";

/**
 * On normalise les erreurs Firebase Functions (RNFB)
 * pour avoir { code, message, details } propre.
 */
function normalizeCallableError(e) {
  // RNFB renvoie souvent: e.code, e.message, e.details
  const code = e?.code || e?.details?.code || null;
  const message = e?.message || String(e);
  const details = e?.details ?? null;

  // Dans certains cas, la "reason" est dans message
  // ex: "functions/failed-precondition" ou message direct.
  return { code, message, details, raw: e };
}

/**
 * Utilitaire: détecte un "error key" custom qui est passé comme message
 * ex: throw new HttpsError("failed-precondition", "OWNER_MUST_TRANSFER_BEFORE_LEAVING", {...})
 */
function getErrorKey(err) {
  const msg = String(err?.message || "");
  // RNFB peut prefixer "functions/..." ou garder le texte tel quel
  // On garde les clés qu'on utilise côté CF.
  const candidates = [
    "OWNER_MUST_TRANSFER_BEFORE_LEAVING",
    "OWNER_GROUP_LIMIT_REACHED",
    "MEMBER_GROUP_LIMIT_REACHED",
  ];
  return candidates.find((k) => msg.includes(k)) || null;
}

async function call(name, data) {
  try {
    const callable = functions().httpsCallable(name);
    const res = await callable(data || {});
    return res?.data;
  } catch (e) {
    const err = normalizeCallableError(e);
    err.key = getErrorKey(err);
    throw err;
  }
}

/**
 * Quitter un groupe.
 * - member => quitte (ok: true, mode: "left")
 * - owner:
 *    - si owner + Nova seulement => supprime/archivage (mode: "deleted")
 *    - sinon => erreur OWNER_MUST_TRANSFER_BEFORE_LEAVING
 */
export async function leaveGroupService({ groupId }) {
  if (!groupId) throw new Error("groupId manquant");
  return call("leaveGroup", { groupId: String(groupId) });
}

/**
 * Supprimer (archiver) un groupe (owner seulement).
 */
export async function deleteGroupService({ groupId }) {
  if (!groupId) throw new Error("groupId manquant");
  return call("deleteGroup", { groupId: String(groupId) });
}

/**
 * Transférer la propriété du groupe à un membre HUMAIN.
 * (refuse newOwnerUid === "ai")
 */
export async function transferGroupOwnershipService({ groupId, newOwnerUid }) {
  if (!groupId) throw new Error("groupId manquant");
  if (!newOwnerUid) throw new Error("newOwnerUid manquant");
  return call("transferGroupOwnership", {
    groupId: String(groupId),
    newOwnerUid: String(newOwnerUid),
  });
}

/**
 * Helpers UI pour décider quels boutons afficher
 * à partir d'une liste de memberships.
 *
 * memberships: [{ uid, role, active, status, type }]
 */
export function computeOwnerActions({ myUid, memberships }) {
  const list = Array.isArray(memberships) ? memberships : [];
  const isActive = (m) =>
    (m?.active === true || m?.active === undefined) &&
    String(m?.status || "active").toLowerCase() === "active";

  const isAi = (m) =>
    String(m?.uid || "") === "ai" || String(m?.type || "").toLowerCase() === "ai";

  const actives = list.filter(isActive);
  const humans = actives.filter((m) => !isAi(m));
  const otherHumans = humans.filter((m) => String(m?.uid) !== String(myUid));

  const hasOtherHuman = otherHumans.length > 0;

  return {
    hasOtherHuman,              // => montrer "Transférer la propriété"
    canOwnerLeaveOrDelete: !hasOtherHuman, // => owner peut quitter (et ça delete) si seul + Nova
    otherHumans,                // utile pour UI picker
  };
}