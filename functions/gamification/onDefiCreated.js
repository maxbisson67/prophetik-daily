// functions/gamification/onDefiCreated.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { awardCredit } from './utils.js';

const db = getFirestore();

/**
 * +1 crédit au premier défi créé par l'utilisateur.
 */
export const onDefiCreated = onDocumentCreated('defis/{defiId}', async (event) => {
  const defiId = event.params.defiId;
  const d = event.data?.data() || {};
  const uid = d.createdBy || null;
  if (!uid) return;

  try {
    const q = await db.collection('defis').where('createdBy', '==', uid).limit(2).get();
    const count = q.size;

    if (count === 1) {
      await awardCredit({
        uid,
        delta: 1,
        reason: 'first_defi',
        meta: { ref: { type: 'defi', id: defiId } },
        idempotencyKey: `first_defi:${uid}`,
        defiId,
        groupId: d.groupId || null,
      });
     // Marquer l’achievement pour l’UI
      await db.collection('participants').doc(uid).set(
        { achievements: { firstDefiCreated: true } },
        { merge: true }
      );
      logger.info('Awarded first_defi +1', { uid, defiId });
    }
  } catch (e) {
    logger.error('onDefiCreated failed', { error: e?.message || String(e) });
  }
});