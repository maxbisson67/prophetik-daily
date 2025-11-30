// functions/gamification/onParticipationCreated.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { awardCredit } from './utils.js';

const db = getFirestore();

function todayUtcDateString() {
  // "YYYY-MM-DD" en UTC
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtcDateString() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Déclenché lorsqu’une participation est créée :
 *   /groups/{groupId}/defis/{defiId}/participations/{participantId}
 *
 * Effets :
 *  - participants/{uid}.stats.totalParticipations++ (global)
 *  - mise à jour de la série de jours consécutifs (stats.currentStreakDays, maxStreakDays, lastParticipationDay)
 *  - achievements (cycliques pour encourager la répétition) :
 *      - fiveParticipationsAny : true seulement quand on est sur un multiple de 5 (5,10,15,20,25…), sinon false
 *      - threeConsecutiveDays : true quand currentStreak est multiple de 3 (3,6,9…), sinon false
 *  - crédits (répétitifs) :
 *      - tous les 5 participations → +2 crédits (reason: "five_participations_any")
 *      - tous les 3 jours consécutifs → +1 crédit (reason: "three_consecutive_days")
 *  - chaque gain de crédit passe par awardCredit → écrit aussi dans credit_logs
 */
export const onParticipationCreated = onDocumentCreated(
  'groups/{groupId}/defis/{defiId}/participations/{participantId}',
  async (event) => {
    const { groupId, defiId, participantId } = event.params;

    logger.info('[onParticipationCreated] TRIGGERED', {
      groupId,
      defiId,
      participantId,
    });

    try {
      const participantRef = db.collection('participants').doc(participantId);
      const snap = await participantRef.get();

      if (!snap.exists) {
        logger.warn('[onParticipationCreated] participant doc inexistant', {
          participantId,
          groupId,
          defiId,
        });
        return;
      }

      const data = snap.data() || {};
      const stats = data.stats || {};
      const achievements = data.achievements || {};

      const prevTotal = Number(stats.totalParticipations || 0);

      // ---------- 1) Stat global: totalParticipations ----------
      const newTotal = prevTotal + 1;

      // ---------- 2) Série de jours consécutifs ----------
      const today = todayUtcDateString();
      const yesterday = yesterdayUtcDateString();
      const lastDay = stats.lastParticipationDay || null;

      let currentStreak = Number(stats.currentStreakDays || 0);

      if (!lastDay) {
        // Première participation connue
        currentStreak = 1;
      } else if (lastDay === today) {
        // Même jour → on ne casse pas la série, mais on ne l’augmente pas
        currentStreak = currentStreak || 1;
      } else if (lastDay === yesterday) {
        // Jour consécutif
        currentStreak = (currentStreak || 0) + 1;
      } else {
        // Rupture de série
        currentStreak = 1;
      }

      const maxStreak = Math.max(
        Number(stats.maxStreakDays || 0),
        currentStreak
      );

      // ---------- 3) Achievements côté booléens (cycliques) ----------
      // On part d'une copie des achievements existants
      const nextAchievements = { ...achievements };

      // Cycle 5 participations : 1,2,3,4,5,1,2,3,4,5,...
      const cycle5 = newTotal % 5;
      const hitFive = newTotal > 0 && cycle5 === 0;

      if (hitFive) {
        // On marque le défi comme atteint pour l'UI
        nextAchievements.fiveParticipationsAny = true;
      } else if (achievements.fiveParticipationsAny) {
        // Dès que l'on sort du palier, on remet à false
        nextAchievements.fiveParticipationsAny = false;
      }

      // Cycle 3 jours consécutifs : 1,2,3,1,2,3,...
      const cycle3 = currentStreak % 3;
      const hitThree = currentStreak > 0 && cycle3 === 0;

      if (hitThree) {
        nextAchievements.threeConsecutiveDays = true;
      } else if (achievements.threeConsecutiveDays) {
        nextAchievements.threeConsecutiveDays = false;
      }

      // ---------- 4) Gamification crédits (répétitif) ----------
      // Tous les 5 participations globales → +1
      let earnedFromFive = 0;
      if (hitFive) {
        earnedFromFive = 1;
      }

      // Tous les 3 jours consécutifs → +1
      let earnedFromThree = 0;
      if (hitThree) {
        earnedFromThree = 1;
      }

      logger.info('[onParticipationCreated] COMPUTED', {
        participantId,
        groupId,
        defiId,
        prevTotal,
        newTotal,
        currentStreak,
        cycle5,
        cycle3,
        hitFive,
        hitThree,
        earnedFromFive,
        earnedFromThree,
        beforeAchievements: achievements,
        nextAchievements,
      });

      // ---------- 5) Mise à jour du doc participants/{uid} ----------
      const updates = {
        stats: {
          ...stats,
          totalParticipations: newTotal,
          currentStreakDays: currentStreak,
          maxStreakDays: maxStreak,
          lastParticipationDay: today,
        },
        achievements: nextAchievements,
      };

      await participantRef.set(updates, { merge: true });

      logger.info('[onParticipationCreated] STATS_UPDATED', {
        participantId,
        groupId,
        defiId,
        newTotal,
        currentStreak,
        maxStreak,
        appliedAchievements: nextAchievements,
      });

      // ---------- 6) Crédits via awardCredit (écrit aussi dans credit_logs) ----------
      // 6.a) Palier 5 participations (répétitif)
      if (earnedFromFive > 0) {
        const idKeyFive = `five_participations_any:${participantId}:total:${newTotal}`;

        await awardCredit(participantId, earnedFromFive, {
          reason: 'five_participations_any',
          meta: {
            groupId,
            defiId,
            ref: { type: 'defi', id: defiId },
          },
          idempotencyKey: idKeyFive,
        });

        logger.info('[onParticipationCreated] CREDIT_FIVE_PARTICIPATIONS', {
          participantId,
          groupId,
          defiId,
          amount: earnedFromFive,
          newTotal,
          idKeyFive,
        });
      }

      // 6.b) Palier 3 jours consécutifs (répétitif)
      if (earnedFromThree > 0) {
        const idKeyThree = `three_consecutive_days:${participantId}:streak:${currentStreak}`;

        await awardCredit(participantId, earnedFromThree, {
          reason: 'three_consecutive_days',
          meta: {
            groupId,
            defiId,
            ref: { type: 'defi', id: defiId },
          },
          idempotencyKey: idKeyThree,
        });

        logger.info('[onParticipationCreated] CREDIT_THREE_DAYS', {
          participantId,
          groupId,
          defiId,
          amount: earnedFromThree,
          currentStreak,
          idKeyThree,
        });
      }

      logger.info('[onParticipationCreated] DONE', {
        participantId,
        groupId,
        defiId,
        newTotal,
        currentStreak,
        earnedFromFive,
        earnedFromThree,
      });
    } catch (e) {
      logger.error('[onParticipationCreated] ERROR', {
        error: e?.message,
        stack: e?.stack,
        groupId,
        defiId,
        participantId,
      });
    }
  }
);