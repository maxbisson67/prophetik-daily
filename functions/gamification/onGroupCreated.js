// functions/gamification/onGroupCreated.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { awardCredit } from './utils.js';

const db = getFirestore();

/**
 * +1 crédit au premier groupe créé par l'utilisateur.
 */
export const onGroupCreated = onDocumentCreated('groups/{groupId}', async (event) => {
  const groupId = event.params.groupId;
  const g = event.data?.data() || {};
  const uid = g.createdBy || g.ownerId || null;
  if (!uid) return;

  try {
    const q = await db.collection('groups').where('createdBy', '==', uid).limit(2).get();
    const count = q.size;

    if (count === 1) {
      await awardCredit({
        uid,
        delta: 1,
        reason: 'first_group',
        meta: { ref: { type: 'group', id: groupId } },
        idempotencyKey: `first_group:${uid}`,
        groupId,
      });
      // Marquer l’achievement pour l’UI
      await db.collection('participants').doc(uid).set(
        { achievements: { firstGroupCreated: true } },
        { merge: true }
      );
      logger.info('Awarded first_group +1', { uid, groupId });
    }
  } catch (e) {
    logger.error('onGroupCreated failed', { error: e?.message || String(e) });
  }
});