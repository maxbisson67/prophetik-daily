/** Comptage centralisé des groupes possédés et Autopilot. */

export function isActiveOwnedGroup(data = {}) {
  if (data.active === false) return false;
  const status = String(data.status || "active").toLowerCase();
  return status !== "archived" && status !== "deleted";
}

export function isGroupAutopilotEnabled(data = {}) {
  return data?.autopilotEnabled !== false;
}

function normalizeOwnedGroupDoc(doc) {
  const data = doc.data() || {};
  if (!isActiveOwnedGroup(data)) return null;

  return {
    id: doc.id,
    name: String(data.name || data.title || "").trim() || doc.id,
    autopilotEnabled: isGroupAutopilotEnabled(data),
    sport: String(data.sport || data.league || "NHL").toUpperCase(),
  };
}

/** Liste des groupes actifs possédés par l'utilisateur. */
export async function listOwnedGroups(db, uid) {
  const snap = await db
    .collection("groups")
    .where("ownerId", "==", String(uid))
    .get();

  return snap.docs.map(normalizeOwnedGroupDoc).filter(Boolean);
}

export async function countOwnedGroups(db, uid, limitPlusOne = null) {
  const owned = await listOwnedGroups(db, uid);
  if (limitPlusOne == null) return owned.length;
  return owned.slice(0, limitPlusOne).length;
}

/** Groupes possédés avec Autopilot activé. */
export async function countAutopilotOwnedGroups(db, uid) {
  const owned = await listOwnedGroups(db, uid);
  return owned.filter((group) => group.autopilotEnabled).length;
}

export async function listAutopilotOwnedGroups(db, uid) {
  const owned = await listOwnedGroups(db, uid);
  return owned.filter((group) => group.autopilotEnabled);
}
