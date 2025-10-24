// functions/gamification/onParticipationCreated.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { awardCredit, todayLocalISO } from './utils.js';

const db = getFirestore();

/**
 * Attribution des crédits liés aux participations :
 * - Maintient les stats (totalParticipations, streak par jour local).
 * - +2 crédits quand totalParticipations atteint 5 (one-shot).
 * - +2 crédits quand streak >= 3 jours (one-shot).
 *
 * Suppose que chaque participation crée un doc à:
 * defis/{defiId}/participants/{uid}
 */
export const onParticipationCreated = onDocumentCreated('defis/{defiId}/participants/{uid}', async (event) => {
  const defiId = event.params.defiId;
  const uid = event.params.uid;
  if (!uid) return;

  try {
    const dRef = db.collection('defis').doc(defiId);
    const dSnap = await dRef.get();
    const groupId = dSnap.exists ? (dSnap.data().groupId || null) : null;

    const pRef = db.collection('participants').doc(uid);
    const today = todayLocalISO();
    let after = null;

    await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(pRef);
      const p = pSnap.exists ? (pSnap.data() || {}) : {};
      const stats = p.stats || {};
      const ach = p.achievements || {};

      const prevTotal = stats.totalParticipations || 0;
      const total = prevTotal + 1;

      const last = stats.lastParticipationDay || null;
      let current = stats.currentStreakDays || 0;

      if (!last) {
        current = 1;
      } else if (last === today) {
        // same day -> streak unchanged
      } else {
        const wasYesterday = (() => {
          try {
            const [y, m, d] = last.split('-').map((n) => parseInt(n, 10));
            const prev = new Date(y, m - 1, d);
            prev.setDate(prev.getDate() + 1);
            const pad = (n) => String(n).padStart(2, '0');
            const nextOfLast = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
            return nextOfLast === today;
          } catch {
            return false;
          }
        })();
        current = wasYesterday ? current + 1 : 1;
      }

      const maxStreak = Math.max(current, stats.maxStreakDays || 0);

      tx.set(
        pRef,
        {
          stats: {
            totalParticipations: total,
            lastParticipationDay: today,
            currentStreakDays: current,
            maxStreakDays: maxStreak,
          },
          achievements: {
            firstDefiCreated: !!(p.achievements && p.achievements.firstDefiCreated),
            firstGroupCreated: !!(p.achievements && p.achievements.firstGroupCreated),
            fiveParticipationsAny: !!(p.achievements && p.achievements.fiveParticipationsAny),
            threeConsecutiveDays: !!(p.achievements && p.achievements.threeConsecutiveDays),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      after = { total, current, ach };
    });

    if (after.total === 5 && !after.ach?.fiveParticipationsAny) {
      await awardCredit({
        uid,
        delta: 2,
        reason: '5_participations',
        meta: { ref: { type: 'defi', id: defiId } },
        idempotencyKey: `5_participations:${uid}`,
        defiId,
        groupId,
      });
      await db.collection('participants').doc(uid).set(
        { achievements: { fiveParticipationsAny: true } },
        { merge: true }
      );
      logger.info('Awarded 5_participations +2', { uid });
    }

    if (after.current >= 3 && !after.ach?.threeConsecutiveDays) {
      await awardCredit({
        uid,
        delta: 2,
        reason: '3_consecutive_days',
        meta: { ref: { type: 'defi', id: defiId } },
        idempotencyKey: `3_consecutive_days:${uid}`,
        defiId,
        groupId,
      });
      await db.collection('participants').doc(uid).set(
        { achievements: { threeConsecutiveDays: true } },
        { merge: true }
      );
      logger.info('Awarded 3_consecutive_days +2', { uid });
    }
  } catch (e) {
    logger.error('onParticipationCreated failed', { error: e?.message || String(e) });
  }
});