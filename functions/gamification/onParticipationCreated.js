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
  // ✅ bon chemin: participations (et non participants)
  'defis/{defiId}/participations/{uid}',
  async (event) => {
    const { uid, defiId } = event.params || {};
    if (!uid) return;

    // Pour la streak, on fige "aujourd’hui" côté serveur
    const nowTs = Timestamp.now();
    const todayYmd = ymdUTC(nowTs.toDate());

    const pRef = db.doc(`participants/${uid}`);

    // Ces flags nous diront APRÈS la transaction quoi créditer (idempotent)
    let justHitFive = false;
    let justHitThreeStreak = false;

    await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(pRef);
      const p = pSnap.exists ? pSnap.data() : {};

      // --- Stats existantes ---
      const stats = p?.stats || {};
      const ach = p?.achievements || {};

      const prevTotal = Number(stats.totalParticipations || 0);
      const prevLastDay = stats.lastParticipationDay || null; // YYYY-MM-DD
      const prevCurrent = Number(stats.currentStreakDays || 0);
      const prevMax = Number(stats.maxStreakDays || 0);

      // --- Nouveau total ---
      const total = prevTotal + 1;

      // --- Calcul de streak (par jours) ---
      let current = prevCurrent;
      if (!prevLastDay) {
        // Première participation connue
        current = 1;
      } else if (prevLastDay === todayYmd) {
        // Même jour: on garde la streak telle quelle (pas d’incrément)
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

      // --- Achievements à poser (sans écrasement) ---
      const updates = {
        'stats.totalParticipations': total,
        'stats.lastParticipationDay': todayYmd,
        'stats.currentStreakDays': current,
        'stats.maxStreakDays': maxStreak,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // - 5 participations (peu importe le jour/groupe)
      if (!ach?.fiveParticipationsAny && total >= 5) {
        updates['achievements.fiveParticipationsAny'] = true;
        justHitFive = true; // sera utilisé après la transaction
      }

      // - 3 jours consécutifs
      if (!ach?.threeConsecutiveDays && current >= 3) {
        updates['achievements.threeConsecutiveDays'] = true;
        justHitThreeStreak = true;
      }

      tx.set(pRef, updates, { merge: true });
    });

    // --- Récompenses (idempotentes) en DEHORS de la transaction ---
    try {
      // Donne 2 crédits à l’atteinte de chaque jalon (à adapter si besoin)
      if (justHitFive) {
        await awardCredit(db, {
          uid,
          amount: 2,
          reason: 'ACH_FIVE_PARTICIPATIONS_ANY',
          // Idempotency key stable: même si la fonction est rejouée, un seul crédit sera ajouté
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
      // Pas de throw: l’achèvement reste posé; la récompense pourra être rejouée via batch admin si besoin,
      // et l’idempotency key empêchera le double crédit.
    }
  }
);