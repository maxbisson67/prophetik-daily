import { getAuth } from "firebase-admin/auth";
import { db, FieldValue, logger } from "../utils.js";

const AI_UID = "ai";
const DELETED_DISPLAY = "Utilisateur supprimé";
const BATCH_SIZE = 400;

function isAiMembership(data = {}) {
  const uid = String(data?.uid || "");
  const type = String(data?.type || "").toLowerCase();
  return uid === AI_UID || type === "ai";
}

function isActiveMembership(data = {}) {
  const status = String(data?.status || "active").toLowerCase();
  const active = data?.active === true || data?.active === undefined;
  return active && status === "active";
}

async function deleteSubcollections(docRef) {
  const deleted = [];
  const subcols = await docRef.listCollections();

  for (const sub of subcols) {
    let snap = await sub.limit(BATCH_SIZE).get();
    while (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted.push(...snap.docs.map((d) => d.ref.path));
      snap = await sub.limit(BATCH_SIZE).get();
    }
  }

  return deleted;
}

async function deleteQueryDocs(query) {
  const snap = await query.get();
  if (snap.empty) return [];

  const paths = snap.docs.map((d) => d.ref.path);
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return paths;
}

async function getActiveMemberships(groupId) {
  const snap = await db.collection("group_memberships").where("groupId", "==", String(groupId)).get();
  return snap.docs
    .map((d) => ({ id: d.id, ref: d.ref, data: d.data() || {} }))
    .filter((r) => isActiveMembership(r.data));
}

async function archiveGroupAndMemberships(groupRef, actives, now) {
  const batch = db.batch();
  batch.set(
    groupRef,
    {
      status: "archived",
      active: false,
      deletedAt: now,
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
}

async function transferGroupOwnershipInternal(groupId, fromUid, toUid) {
  const gRef = db.collection("groups").doc(String(groupId));
  const gSnap = await gRef.get();
  if (!gSnap.exists) return false;

  const g = gSnap.data() || {};
  const ownerId = g.ownerId || g.createdBy || null;
  if (String(ownerId) !== String(fromUid)) return false;

  const membershipsSnap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .where("uid", "==", String(toUid))
    .limit(1)
    .get();

  if (membershipsSnap.empty) return false;

  const newM = membershipsSnap.docs[0].data() || {};
  if (!isActiveMembership(newM) || isAiMembership(newM)) return false;

  const oldMembershipSnap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .where("uid", "==", String(fromUid))
    .limit(1)
    .get();

  if (oldMembershipSnap.empty) return false;

  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.set(
      gRef,
      {
        ownerId: String(toUid),
        ownerName: newM.displayName || "Membre",
        ownerAvatarUrl: newM.avatarUrl || null,
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      oldMembershipSnap.docs[0].ref,
      {
        role: "member",
        updatedAt: now,
      },
      { merge: true }
    );

    tx.set(
      membershipsSnap.docs[0].ref,
      {
        role: "owner",
        updatedAt: now,
      },
      { merge: true }
    );
  });

  return true;
}

async function resolveGroupMemberships(uid) {
  const now = FieldValue.serverTimestamp();
  const summary = { archivedGroups: 0, transferredGroups: 0, leftMemberships: 0 };

  const ownedSnap = await db.collection("groups").where("ownerId", "==", uid).get();
  for (const groupDoc of ownedSnap.docs) {
    const g = groupDoc.data() || {};
    if (String(g.status || "").toLowerCase() === "archived") continue;

    const actives = await getActiveMemberships(groupDoc.id);
    const otherHumans = actives.filter(
      (m) => !isAiMembership(m.data) && String(m.data.uid) !== String(uid)
    );

    if (otherHumans.length === 0) {
      await archiveGroupAndMemberships(groupDoc.ref, actives, now);
      summary.archivedGroups += 1;
      continue;
    }

    const nextOwner = otherHumans[0].data.uid;
    const transferred = await transferGroupOwnershipInternal(groupDoc.id, uid, nextOwner);
    if (transferred) summary.transferredGroups += 1;
  }

  const membershipsSnap = await db
    .collection("group_memberships")
    .where("uid", "==", uid)
    .get();

  for (const mDoc of membershipsSnap.docs) {
    const data = mDoc.data() || {};
    if (!isActiveMembership(data)) continue;

    await mDoc.ref.set(
      {
        status: "left",
        active: false,
        leftAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    summary.leftMemberships += 1;
  }

  return summary;
}

async function anonymizeCollectionGroupDocs(collectionId, uid) {
  const snap = await db.collectionGroup(collectionId).get();
  const mine = snap.docs.filter((d) => d.id === uid);
  if (!mine.length) return 0;

  let updated = 0;
  for (let i = 0; i < mine.length; i += BATCH_SIZE) {
    const chunk = mine.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((docSnap) => {
      batch.set(
        docSnap.ref,
        {
          accountDeleted: true,
          displayName: DELETED_DISPLAY,
          avatarUrl: null,
          photoURL: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
    updated += chunk.length;
  }

  return updated;
}

async function deleteNovaQuotaDocs(uid) {
  const snap = await db.collection("nova_quotas").get();
  const mine = snap.docs.filter((d) => d.id.startsWith(`${uid}_`));
  if (!mine.length) return [];

  const batch = db.batch();
  mine.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return mine.map((d) => d.ref.path);
}

async function deleteUsageWeeklyDocs(uid) {
  const snap = await db.collection("usage_weekly").get();
  const mine = snap.docs.filter((d) => d.id.startsWith(`${uid}_`));
  if (!mine.length) return [];

  const batch = db.batch();
  mine.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return mine.map((d) => d.ref.path);
}

async function deleteNovaCoachLogs(uid) {
  return deleteQueryDocs(db.collection("nova_coach_logs").where("uid", "==", uid));
}

/**
 * Supprime définitivement les données personnelles d'un utilisateur.
 * Anonymise les participations/entries pour préserver l'intégrité des défis.
 */
export async function deleteUserAccount(uid) {
  if (!uid) throw new Error("missing-uid");

  const summary = {
    uid,
    groups: null,
    anonymizedParticipations: 0,
    anonymizedEntries: 0,
    deletedPaths: [],
  };

  summary.groups = await resolveGroupMemberships(uid);

  summary.anonymizedParticipations = await anonymizeCollectionGroupDocs("participations", uid);
  summary.anonymizedEntries = await anonymizeCollectionGroupDocs("entries", uid);

  const participantRef = db.doc(`participants/${uid}`);
  const participantSnap = await participantRef.get();
  if (participantSnap.exists) {
    summary.deletedPaths.push(...(await deleteSubcollections(participantRef)));
    await participantRef.delete();
    summary.deletedPaths.push(participantRef.path);
  }

  for (const docPath of [`profiles_public/${uid}`, `entitlements/${uid}`, `nova_memory/${uid}`]) {
    const ref = db.doc(docPath);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      summary.deletedPaths.push(ref.path);
    }
  }

  summary.deletedPaths.push(...(await deleteQueryDocs(db.collection("credit_grants").where("uid", "==", uid))));

  const signupGrantRef = db.doc(`credit_grants/signup_${uid}`);
  if ((await signupGrantRef.get()).exists) {
    await signupGrantRef.delete();
    summary.deletedPaths.push(signupGrantRef.path);
  }

  summary.deletedPaths.push(...(await deleteNovaQuotaDocs(uid)));
  summary.deletedPaths.push(...(await deleteUsageWeeklyDocs(uid)));
  summary.deletedPaths.push(...(await deleteNovaCoachLogs(uid)));

  const chatRateRef = db.doc(`chat_rate_limits/${uid}`);
  if ((await chatRateRef.get()).exists) {
    await chatRateRef.delete();
    summary.deletedPaths.push(chatRateRef.path);
  }

  try {
    await getAuth().deleteUser(uid);
    summary.authDeleted = true;
  } catch (e) {
    if (e?.code === "auth/user-not-found") {
      summary.authDeleted = false;
      summary.authSkipped = "user-not-found";
    } else {
      throw e;
    }
  }

  logger.info("[deleteAccount] completed", {
    uid,
    groups: summary.groups,
    anonymizedParticipations: summary.anonymizedParticipations,
    anonymizedEntries: summary.anonymizedEntries,
    authDeleted: summary.authDeleted,
  });

  return summary;
}
