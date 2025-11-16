// functions/onParticipationCreated.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { awardCredit } from './utils.js';

const db = getFirestore();

/** YYYY-MM-DD (UTC) */
function ymdUTC(d) {
  const dd = d instanceof Date ? d : new Date(d);
  const y = dd.getUTCFullYear();
  const m = String(dd.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dd.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Diff en jours (UTC) entre deux YMD strings (t2 - t1). */
function diffDaysYmd(t1, t2) {
  if (!t1 || !t2) return NaN;
  const a = new Date(`${t1}T00:00:00Z`).getTime();
  const b = new Date(`${t2}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export const onParticipationCreated = onDocumentCreated(
  'defis/{defiId}/participations/{uid}',
  async (event) => {
    const { uid } = event.params || {};
    if (!uid) return;

    const nowTs = Timestamp.now();
    const todayYmd = ymdUTC(nowTs.toDate());

    const pRef = db.doc(`participants/${uid}`);

    let justHitFive = false;
    let justHitThreeStreak = false;

    await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(pRef);
      const p = pSnap.exists ? pSnap.data() : {};

      // Stats & achievements existantes (toujours sous forme de map)
      const stats = p.stats || {};
      const ach   = p.achievements || {};

      const prevTotal   = Number(stats.totalParticipations || 0);
      const prevLastDay = stats.lastParticipationDay || null; // YYYY-MM-DD
      const prevCurrent = Number(stats.currentStreakDays || 0);
      const prevMax     = Number(stats.maxStreakDays || 0);

      const total = prevTotal + 1;

      // --- Calcul de streak ---
      let current = prevCurrent;
      if (!prevLastDay) {
        // Première participation
        current = 1;
      } else if (prevLastDay === todayYmd) {
        // Même jour → pas d’incrément de streak
        current = prevCurrent > 0 ? prevCurrent : 1;
      } else {
        const d = diffDaysYmd(prevLastDay, todayYmd);
        if (d === 1) {
          // Jour consécutif
          current = (prevCurrent || 0) + 1;
        } else {
          // Nouvelle séquence
          current = 1;
        }
      }

      const maxStreak = Math.max(prevMax || 0, current);

      // 🧱 Nouveau map stats propre
      const nextStats = {
        ...stats,
        totalParticipations: total,
        lastParticipationDay: todayYmd,
        currentStreakDays: current,
        maxStreakDays: maxStreak,
      };

      const updates = {
        stats: nextStats,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // --- Achievements ---
      if (!ach.fiveParticipationsAny && total >= 5) {
        updates.achievements = {
          ...ach,
          fiveParticipationsAny: true,
        };
        justHitFive = true;
      }

      if (!ach.threeConsecutiveDays && current >= 3) {
        updates.achievements = {
          ...(updates.achievements || ach),
          threeConsecutiveDays: true,
        };
        justHitThreeStreak = true;
      }

      tx.set(pRef, updates, { merge: true });
    });

    // Récompenses en dehors de la transaction
    try {
      if (justHitFive) {
        await awardCredit(db, {
          uid,
          amount: 2,
          reason: 'ACH_FIVE_PARTICIPATIONS_ANY',
          idempotencyKey: `ach:five_any:${uid}`,
        });
      }

      if (justHitThreeStreak) {
        await awardCredit(db, {
          uid,
          amount: 2,
          reason: 'ACH_THREE_CONSECUTIVE_DAYS',
          idempotencyKey: `ach:streak3:${uid}`,
        });
      }
    } catch (e) {
      console.error('[onParticipationCreated] awardCredit error:', e?.message || e);
    }
  }
);