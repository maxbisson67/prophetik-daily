// functions/groupsManagement.js
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, logger } from './utils.js';

/**
 * Un participant quitte un groupe dont il est membre.
 * - Ne fonctionne pas pour le owner (il doit d'abord transférer ou supprimer le groupe).
 */
export const leaveGroup = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }

  const groupId = req.data?.groupId;
  if (!groupId || typeof groupId !== 'string') {
    throw new HttpsError('invalid-argument', 'Paramètre "groupId" requis.');
  }

  // On cherche le membership { groupId, uid }
  const membSnap = await db
    .collection('group_memberships')
    .where('groupId', '==', groupId)
    .where('uid', '==', uid)
    .limit(1)
    .get();

  if (membSnap.empty) {
    throw new HttpsError('not-found', "Tu n'es pas membre de ce groupe ou tu es le propriétaire.");
  }

  const membDoc = membSnap.docs[0];
  const memb = membDoc.data() || {};

  const role = String(memb.role || '').toLowerCase();

  // Option : interdire au propriétaire de "quitter"
  if (role === 'owner') {
    throw new HttpsError(
      'failed-precondition',
      'Le propriétaire ne peut quitter le groupe.'
    );
  }

  await membDoc.ref.set(
    {
      status: 'left',
      active: false,
      leftAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info('leaveGroup', { uid, groupId, membershipId: membDoc.id });

  return { ok: true };
});

/**
 * Owner supprime / archive un groupe.
 * - Soft delete : status = 'archived'
 * - Les membres sont marqués "archived" / "inactive"
 */
export const deleteGroup = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }

  const groupId = req.data?.groupId;
  if (!groupId || typeof groupId !== 'string') {
    throw new HttpsError('invalid-argument', 'Paramètre "groupId" requis.');
  }

  const gRef = db.collection('groups').doc(groupId);
  const gSnap = await gRef.get();

  if (!gSnap.exists) {
    throw new HttpsError('not-found', 'Groupe introuvable.');
  }

  const g = gSnap.data() || {};
  const ownerId = g.ownerId || g.createdBy || null;

  if (ownerId !== uid) {
    throw new HttpsError(
      'permission-denied',
      'Seul le propriétaire du groupe peut le supprimer.'
    );
  }

  // On récupère tous les memberships du groupe
  const membSnap = await db
    .collection('group_memberships')
    .where('groupId', '==', groupId)
    .get();

  const batch = db.batch();

  // On "archive" le groupe
  batch.set(
    gRef,
    {
      status: 'archived',
      active: false,
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // On marque les memberships comme inactifs/archivés
  membSnap.forEach((doc) => {
    batch.set(
      doc.ref,
      {
        status: 'archived',
        active: false,
        leftAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();

  logger.info('deleteGroup', {
    uid,
    groupId,
    membersUpdated: membSnap.size,
  });

  return { ok: true, membersUpdated: membSnap.size };
});