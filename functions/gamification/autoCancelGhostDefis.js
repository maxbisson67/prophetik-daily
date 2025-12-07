// functions/gamification/autoCancelGhostDefis.js
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { awardCredit } from './utils.js';

const db = getFirestore();

/**
 * Annule les "défis fantômes" (ghost defis) dans la collection racine `defis` :
 * - signupDeadline passée (<= now)
 * - status encore "open"/"active" (par défaut "open" si absent)
 * - participantsCount < 2
 *
 * Effets :
 * - remboursement automatique du coût d’entrée à chaque participant inscrit
 * - mise à jour du défi : status = "cancelled_ghost",
 *   cancelledReason = "not_enough_participants",
 *   cancelledAt = serverTimestamp(),
 *   ghostHandled = true (idempotence)
 */
export const autoCancelGhostDefis = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'America/Toronto',
  },
  async () => {
    const now = new Date();

    logger.info('[autoCancelGhostDefis] START', {
      now: now.toISOString(),
    });

    let processed = 0;
    let cancelled = 0;

    try {
      // 🔎 On ne regarde que la collection racine "defis"
      const snap = await db
        .collection('defis')
        .where('signupDeadline', '<=', now)
        .get();

      if (snap.empty) {
        logger.info(
          '[autoCancelGhostDefis] Aucun défi (racine defis) avec signupDeadline dépassée.'
        );
        return;
      }

      for (const doc of snap.docs) {
        processed++;

        const data = doc.data() || {};
        const defiId = doc.id;
        const groupId = data.groupId || null; // juste pour logs / idempotency éventuel

        const status = String(data.status || 'open').toLowerCase();
        const participantsCount = Number(data.participantsCount || 0);
        const ghostHandled = data.ghostHandled === true;

        // On ne traite que les défis "ouverts/actifs"
        if (!['open', 'active'].includes(status)) {
          continue;
        }

        // Si déjà traité (pour éviter double remboursement)
        if (ghostHandled) {
          continue;
        }

        // Si assez de participants → pas un défi fantôme
        if (participantsCount >= 2) {
          logger.info('[autoCancelGhostDefis] Defi non-fantôme, rien à faire.', {
            defiId,
            groupId,
            participantsCount,
          });
          continue;
        }

        logger.info('[autoCancelGhostDefis] GHOST_DEFI_DETECTED', {
          defiId,
          groupId,
          status,
          participantsCount,
        });

        // 🔁 Remboursement des participants (0 ou 1 typiquement, mais on boucle proprement)
        const partsSnap = await doc.ref.collection('participations').get();

        const participationCost =
          typeof data.participationCost === 'number'
            ? data.participationCost
            : 0;

        for (const pDoc of partsSnap.docs) {
          const pData = pDoc.data() || {};
          const participantId = pData.participantId || pData.uid || pDoc.id;

          // On laisse une porte ouverte si tu veux un cost custom par participation
          const entryCost =
            typeof pData.entryCost === 'number'
              ? pData.entryCost
              : participationCost;

          if (!participantId || !entryCost || entryCost <= 0) {
            logger.info(
              '[autoCancelGhostDefis] Participation sans coût valable, pas de remboursement.',
              {
                defiId,
                groupId,
                participationId: pDoc.id,
                participantId,
                entryCost,
              }
            );
            continue;
          }

          const gIdForKey = groupId || 'root';
          const idempotencyKey = `defi_refund_ghost:${gIdForKey}:${defiId}:${participantId}`;

          try {
            await awardCredit(participantId, entryCost, {
              reason: 'defi_refund_ghost',
              meta: {
                groupId,
                defiId,
                participationId: pDoc.id,
                ref: { type: 'defi', id: defiId },
              },
              idempotencyKey,
            });

            logger.info('[autoCancelGhostDefis] REFUND_DONE', {
              defiId,
              groupId,
              participantId,
              participationId: pDoc.id,
              entryCost,
              idempotencyKey,
            });
          } catch (e) {
            logger.error('[autoCancelGhostDefis] REFUND_ERROR', {
              defiId,
              groupId,
              participantId,
              participationId: pDoc.id,
              entryCost,
              error: e?.message,
              stack: e?.stack,
            });
          }
        }

        // 🧹 Marquer le défi comme annulé pour manque de participants
        await doc.ref.set(
          {
            status: 'cancelled_ghost',
            ghostHandled: true,
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledReason: 'not_enough_participants',
          },
          { merge: true }
        );

        logger.info('[autoCancelGhostDefis] DEFI_CANCELLED_GHOST', {
          defiId,
          groupId,
          participantsCount,
        });

        cancelled++;
      }

      logger.info('[autoCancelGhostDefis] DONE', {
        processed,
        cancelled,
      });
    } catch (e) {
      logger.error('[autoCancelGhostDefis] FATAL_ERROR', {
        error: e?.message,
        stack: e?.stack,
      });
    }
  }
);