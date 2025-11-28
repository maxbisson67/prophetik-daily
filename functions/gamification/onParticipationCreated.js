// functions/gamification/onParticipationCreated.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const db = getFirestore();

/**
 * Déclenché lorsqu’une participation est créée :
 *   /groups/{groupId}/defis/{defiId}/participations/{participantId}
 *
 * Mise à jour :
 *  - stats du participant
 *  - progression gamification
 *  - attribution de crédits
 *
 * Gamification :
 *  - progress.totalParticipations : +1 à chaque participation
 *  - progress.justHitFive :
 *      - +1 à chaque participation
 *      - quand on atteint 5 → +2 crédits, puis reset à 0
 *  - progress.justHitThreeStreak :
 *      - +1 à chaque participation
 *      - quand on atteint 3 → +1 crédit, puis reset à 0
 */
export const onParticipationCreated = onDocumentCreated(
  'groups/{groupId}/defis/{defiId}/participations/{participantId}',
  async (event) => {
    const { groupId, defiId, participantId } = event.params;

    // (Optionnel) données de la participation si tu en as besoin
    const participationData = event.data?.data() || {};

    const partiRef = db
      .collection('groups')
      .doc(groupId)
      .collection('group_members')
      .doc(participantId);

    try {
      // ----------------------------------------------
      // 1) Charger le participant
      // ----------------------------------------------
      const partiSnap = await partiRef.get();
      if (!partiSnap.exists) {
        logger.warn('onParticipationCreated: participant introuvable', {
          groupId,
          defiId,
          participantId,
        });
        return;
      }

      const parti = partiSnap.data() || {};

      // Structure attendue :
      // progress: {
      //   totalParticipations: number,
      //   justHitFive: number,
      //   justHitThreeStreak: number,
      // }
      const progress = parti.progress || {};

      // ----------------------------------------------
      // 2) Mise à jour de la progression
      // ----------------------------------------------
      const updates = {};
      let earnedCredits = 0;

      // Total des participations
      const newTotal = (progress.totalParticipations || 0) + 1;
      updates['progress.totalParticipations'] = newTotal;

      // ----------------------------------------------
      // 🎯 GAMIFICATION 1 — JUST HIT FIVE (répétitif)
      // ----------------------------------------------
      let justHitFive = (progress.justHitFive || 0) + 1;

      if (justHitFive >= 5) {
        earnedCredits += 2;   // récompense
        justHitFive = 0;      // 🔄 réinitialisation pour une nouvelle série de 5
      }

      updates['progress.justHitFive'] = justHitFive;

      // ----------------------------------------------
      // 🎯 GAMIFICATION 2 — JUST HIT THREE STREAK (répétitif)
      // ----------------------------------------------
      let justHitThree = (progress.justHitThreeStreak || 0) + 1;

      if (justHitThree >= 3) {
        earnedCredits += 1;   // récompense
        justHitThree = 0;     // 🔄 réinitialisation pour une nouvelle série de 3
      }

      updates['progress.justHitThreeStreak'] = justHitThree;

      // ----------------------------------------------
      // 3) Ajouter les crédits gagnés
      // ----------------------------------------------
      if (earnedCredits > 0) {
        updates['credits'] = FieldValue.increment(earnedCredits);

        logger.info('🎉 Crédit(s) attribués (participation)', {
          participantId,
          groupId,
          defiId,
          earnedCredits,
        });
      }

      // ----------------------------------------------
      // 4) Mise à jour Firestore
      // ----------------------------------------------
      await partiRef.set(updates, { merge: true });

      logger.info('Progression participation mise à jour', {
        groupId,
        defiId,
        participantId,
        ...updates,
      });
    } catch (e) {
      logger.error('Erreur onParticipationCreated', {
        error: e?.message,
        groupId,
        defiId,
        participantId,
      });
    }
  }
);