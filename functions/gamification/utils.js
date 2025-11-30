// functions/gamification/utils.js
import { DateTime } from "luxon";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const db = getFirestore();

/**
 * ISO local (YYYY-MM-DD) basé sur le fuseau du serveur.
 */
export function todayLocalISO() {
  const now = DateTime.now();
  return now.toISODate(); // ex: "2025-11-23"
}

/**
 * Mapping "reason" interne → "type" utilisé dans credit_logs
 * (pour que ça matche ton UI dans CreditsScreen)
 */
function reasonToLogType(reason) {
  switch (reason) {
    case "first_defi":
      return "first_defi_reward";
    case "first_group":
      return "first_group_reward";
    case "three_consecutive_days":
      return "streak3_reward";
    case "five_participations_any":
      return "five_particip_reward";
    default:
      // Par défaut on laisse "adjustment" qui est déjà géré dans TYPE_META
      return "adjustment";
  }
}

/**
 * Attribue des crédits à un participant global:
 *  - /participants/{participantId}
 *  - /participants/{participantId}/credit_logs/{autoId}
 *
 * options:
 *  - reason?: string   (ex: "five_participations_any")
 *  - meta?: object     (ex: { groupId, defiId, ref: { type: 'defi', id: ... } })
 *  - idempotencyKey?: string  → évite les doublons (par ex. un même trigger réexécuté)
 */
export async function awardCredit(participantId, delta, options = {}) {
  if (!participantId) {
    logger.warn("awardCredit called without participantId");
    return;
  }
  if (!delta || Number(delta) === 0) {
    logger.info("awardCredit called with zero delta", {
      participantId,
      delta,
      options,
    });
    return;
  }

  const { reason = null, meta = null, idempotencyKey = null } = options;

  const partiRef = db.collection("participants").doc(participantId);

  // --- Idempotence : on ne bloque que sur idempotencyKey, si fourni ---
  let idemRef = null;
  if (idempotencyKey) {
    idemRef = partiRef
      .collection("credit_awards_meta")
      .doc(idempotencyKey);

    const existing = await idemRef.get();
    if (existing.exists) {
      logger.info("awardCredit skipped (idempotent hit)", {
        participantId,
        idempotencyKey,
        reason,
      });
      return;
    }
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(partiRef);
    const data = snap.exists ? snap.data() || {} : {};

    const oldBalance =
      typeof data?.credits?.balance === "number" ? data.credits.balance : 0;
    const newBalance = oldBalance + Number(delta);

    // --- Mise à jour du solde global ---
    tx.set(
      partiRef,
      {
        credits: {
          ...(data.credits || {}),
          balance: newBalance,
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // --- Log dans credit_logs ---
    const logRef = partiRef.collection("credit_logs").doc();
    const logType = reasonToLogType(reason);

    const logPayload = {
      amount: Number(delta),
      type: logType, // ex: "five_particip_reward"
      reason: reason, // garde la reason brute si tu veux la lire plus tard
      fromBalance: oldBalance,
      toBalance: newBalance,
      createdAt: FieldValue.serverTimestamp(),
    };

    if (meta && typeof meta === "object") {
      logPayload.meta = meta;
      if (meta.groupId) logPayload.groupId = meta.groupId;
      if (meta.defiId) logPayload.defiId = meta.defiId;
      if (meta.ref) logPayload.ref = meta.ref;
    }

    tx.set(logRef, logPayload, { merge: true });

    // --- Enregistrement de l'idempotence (facultatif mais utile) ---
    if (idemRef) {
      tx.set(
        idemRef,
        {
          createdAt: FieldValue.serverTimestamp(),
          delta: Number(delta),
          reason,
          logId: logRef.id,
          meta: meta || null,
        },
        { merge: true }
      );
    }
  });

  logger.info("awardCredit applied", {
    participantId,
    delta: Number(delta),
    reason,
    idempotencyKey,
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

// On ré-exporte pour les autres modules qui l'utilisaient déjà
export { db, FieldValue, logger };