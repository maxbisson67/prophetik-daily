// functions/gamification/utils.js
import { DateTime } from "luxon";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/**
 * Instance Firestore partagée
 */
const db = getFirestore();

/**
 * ISO local (YYYY-MM-DD) basé sur le fuseau du serveur.
 */
export function todayLocalISO() {
  const now = DateTime.now();
  return now.toISODate(); // ex: "2025-11-23"
}

/**
 * Attribue des crédits à un participant global:
 *  - /participants/{participantId}
 *
 * On garde la logique "classique" :
 *  - crée le doc s'il n'existe pas
 *  - incrémente credits.balance
 *  - journalise dans sous-collection credits_awards (optionnel)
 *
 * options:
 *  - reason?: string
 *  - meta?: object
 *  - idempotencyKey?: string (évite les doublons)
 */
export async function awardCredit(participantId, delta, options = {}) {
  if (!participantId) {
    logger.warn("awardCredit called without participantId");
    return;
  }
  if (!delta || Number(delta) === 0) {
    logger.info("awardCredit called with zero delta", { participantId, delta });
    return;
  }

  const {
    reason = null,
    meta = null,
    idempotencyKey = null,
  } = options;

  const partiRef = db.collection("participants").doc(participantId);

  // Gestion simple de l'idempotence via credits_awards
  let awardRef = null;
  if (idempotencyKey) {
    awardRef = partiRef.collection("credits_awards").doc(idempotencyKey);
    const existing = await awardRef.get();
    if (existing.exists) {
      logger.info("awardCredit skipped (idempotent)", {
        participantId,
        idempotencyKey,
      });
      return;
    }
  } else {
    awardRef = partiRef.collection("credits_awards").doc();
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(partiRef);
    const data = snap.exists ? snap.data() || {} : {};

    const oldCredits =
      typeof data?.credits?.balance === "number"
        ? data.credits.balance
        : 0;
    const newCredits = oldCredits + delta;

    tx.set(
      partiRef,
      {
        credits: { balance: newCredits },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      awardRef,
      {
        amount: delta,
        reason,
        meta,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  logger.info("awardCredit applied", {
    participantId,
    delta,
    reason,
  });
}

/**
 * Attribue des crédits à plusieurs participants:
 * entries: [{ participantId, delta, options }]
 */
export async function awardCreditsBatch(entries = []) {
  const safeEntries = (entries || []).filter(
    (e) => e && e.participantId && e.delta
  );

  for (const { participantId, delta, options } of safeEntries) {
    await awardCredit(participantId, delta, options);
  }
}

/**
 * Exports communs pour les autres modules
 */
export { db, FieldValue, logger };