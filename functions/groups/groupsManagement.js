import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";

const AI_UID = "ai";

function isAiMembership(m) {
  const uid = String(m?.uid || "");
  const type = String(m?.type || "");
  return uid === AI_UID || type.toLowerCase() === "ai";
}

function isActiveMembership(m) {
  const status = String(m?.status || "active").toLowerCase();
  const active = m?.active === true || m?.active === undefined;
  return active && status === "active";
}

async function getMyMembership(groupId, uid) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .where("uid", "==", String(uid))
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, id: snap.docs[0].id, data: snap.docs[0].data() || {} };
}

async function getGroup(groupId) {
  const gRef = db.collection("groups").doc(String(groupId));
  const gSnap = await gRef.get();
  if (!gSnap.exists) return { ref: gRef, data: null };
  return { ref: gRef, data: gSnap.data() || {} };
}

async function getActiveMemberships(groupId) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get();

  const rows = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() || {} }));
  return rows.filter((r) => isActiveMembership(r.data));
}

/**
 * Un participant quitte un groupe.
 * - Membre: OK
 * - Owner:
 *   - si seulement (owner + Nova) -> deleteGroup (soft delete) + memberships archived
 *   - sinon -> doit transférer d'abord
 */
export const leaveGroup = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

  const groupId = req.data?.groupId;
  if (!groupId || typeof groupId !== "string") {
    throw new HttpsError("invalid-argument", 'Paramètre "groupId" requis.');
  }

  const my = await getMyMembership(groupId, uid);
  if (!my) {
    throw new HttpsError("not-found", "Tu n'es pas membre de ce groupe.");
  }

  const role = String(my.data.role || "").toLowerCase();
  const now = FieldValue.serverTimestamp();

  // ✅ Cas MEMBER (non-owner): quitter normal
  if (role !== "owner") {
    await my.ref.set(
      {
        status: "left",
        active: false,
        leftAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    logger.info("leaveGroup (member)", { uid, groupId, membershipId: my.id });
    return { ok: true, mode: "left" };
  }

  // ✅ Cas OWNER: vérifier s'il reste des humains
  const actives = await getActiveMemberships(groupId);

  const humans = actives.filter((m) => !isAiMembership(m.data));
  // humans contient owner + autres humains

  const otherHumans = humans.filter((m) => String(m.data.uid) !== String(uid));
  const onlyOwnerPlusAi = otherHumans.length === 0; // il n'y a aucun autre humain

  if (!onlyOwnerPlusAi) {
    // Il reste au moins 1 humain (member)
    throw new HttpsError(
      "failed-precondition",
      "OWNER_MUST_TRANSFER_BEFORE_LEAVING",
      {
        reason: "members_present",
        otherHumans: otherHumans.length,
      }
    );
  }

  // ✅ Owner + Nova seulement => on supprime/archive le groupe
  const { ref: gRef, data: g } = await getGroup(groupId);
  if (!g) throw new HttpsError("not-found", "Groupe introuvable.");

  const ownerId = g.ownerId || g.createdBy || null;
  if (String(ownerId) !== String(uid)) {
    throw new HttpsError("permission-denied", "Seul le propriétaire peut supprimer le groupe.");
  }

  // On archive groupe + memberships actifs
  const batch = db.batch();

  batch.set(
    gRef,
    {
      status: "archived",
      active: false,
      deletedAt: now,
      deletedBy: uid,
      updatedAt: now,
    },
    { merge: true }
  );

  actives.forEach((m) => {
    batch.set(
      m.ref,
      {
        status: "archived",
        active: false,
        leftAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  await batch.commit();

  logger.info("leaveGroup (owner->delete)", {
    uid,
    groupId,
    membershipsArchived: actives.length,
  });

  return { ok: true, mode: "deleted", membershipsArchived: actives.length };
});

/**
 * Owner supprime / archive un groupe (soft delete)
 * ⚠️ garde la règle: owner seulement
 */
export const deleteGroup = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

  const groupId = req.data?.groupId;
  if (!groupId || typeof groupId !== "string") {
    throw new HttpsError("invalid-argument", 'Paramètre "groupId" requis.');
  }

  const { ref: gRef, data: g } = await getGroup(groupId);
  if (!g) throw new HttpsError("not-found", "Groupe introuvable.");

  const ownerId = g.ownerId || g.createdBy || null;
  if (String(ownerId) !== String(uid)) {
    throw new HttpsError("permission-denied", "Seul le propriétaire du groupe peut le supprimer.");
  }

  const actives = await getActiveMemberships(groupId);
  const now = FieldValue.serverTimestamp();

  const batch = db.batch();
  batch.set(
    gRef,
    {
      status: "archived",
      active: false,
      deletedAt: now,
      deletedBy: uid,
      updatedAt: now,
    },
    { merge: true }
  );

  actives.forEach((m) => {
    batch.set(
      m.ref,
      {
        status: "archived",
        active: false,
        leftAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  await batch.commit();

  logger.info("deleteGroup", { uid, groupId, membersUpdated: actives.length });
  return { ok: true, membersUpdated: actives.length };
});

/**
 * Transfert de propriété
 * - Owner actuel => choisit newOwnerUid (humain, membre actif du groupe)
 * - Met à jour groups.ownerId/ownerName/ownerAvatarUrl
 * - Met à jour memberships: old owner => member, new => owner
 */
export const transferGroupOwnership = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

  const groupId = req.data?.groupId;
  const newOwnerUid = req.data?.newOwnerUid;

  if (!groupId || typeof groupId !== "string") {
    throw new HttpsError("invalid-argument", 'Paramètre "groupId" requis.');
  }
  if (!newOwnerUid || typeof newOwnerUid !== "string") {
    throw new HttpsError("invalid-argument", 'Paramètre "newOwnerUid" requis.');
  }
  if (String(newOwnerUid) === String(uid)) {
    throw new HttpsError("invalid-argument", "newOwnerUid doit être différent du owner actuel.");
  }
  if (String(newOwnerUid) === AI_UID) {
    throw new HttpsError("invalid-argument", "Impossible de transférer la propriété à Nova.");
  }

  const { ref: gRef, data: g } = await getGroup(groupId);
  if (!g) throw new HttpsError("not-found", "Groupe introuvable.");

  const ownerId = g.ownerId || g.createdBy || null;
  if (String(ownerId) !== String(uid)) {
    throw new HttpsError("permission-denied", "Seul le propriétaire peut transférer la propriété.");
  }

  const now = FieldValue.serverTimestamp();

  // Membership old owner
  const oldM = await getMyMembership(groupId, uid);
  if (!oldM || !isActiveMembership(oldM.data)) {
    throw new HttpsError("failed-precondition", "OWNER_MEMBERSHIP_NOT_ACTIVE");
  }

  // Membership new owner
  const newSnap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .where("uid", "==", String(newOwnerUid))
    .limit(1)
    .get();

  if (newSnap.empty) {
    throw new HttpsError("not-found", "Le nouveau propriétaire doit être membre du groupe.");
  }

  const newDoc = newSnap.docs[0];
  const newM = newDoc.data() || {};
  if (!isActiveMembership(newM)) {
    throw new HttpsError("failed-precondition", "NEW_OWNER_NOT_ACTIVE");
  }
  if (isAiMembership(newM)) {
    throw new HttpsError("invalid-argument", "Impossible de transférer la propriété à Nova.");
  }

  // infos affichage
  const newOwnerName = newM.displayName || "Membre";
  const newOwnerAvatarUrl = newM.avatarUrl || null;

  await db.runTransaction(async (tx) => {
    // 1) group owner fields
    tx.set(
      gRef,
      {
        ownerId: String(newOwnerUid),
        ownerName: newOwnerName,
        ownerAvatarUrl: newOwnerAvatarUrl,
        updatedAt: now,
      },
      { merge: true }
    );

    // 2) memberships roles
    tx.set(
      oldM.ref,
      {
        role: "member",
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      newDoc.ref,
      {
        role: "owner",
        updatedAt: now,
      },
      { merge: true }
    );
  });

  logger.info("transferGroupOwnership", { groupId, from: uid, to: newOwnerUid });
  return { ok: true, groupId, newOwnerUid };
});