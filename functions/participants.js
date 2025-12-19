// functions/participants.js
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { APP_TZ, toYmdInTz, addDaysToYmd } from "./ProphetikDate.js";

import { db, FieldValue, logger, readAnyBalance } from "./utils.js";

// ✅ Helper unifié pour octroyer des crédits (idempotence + logs)
import { grantCreditsTx } from "./credits/grantCredits.js";

const TZ = "America/Toronto";
const SIGNUP_BONUS_AMOUNT = 5;

// ✅ 1 bonus gratuit par 30 jours (modifie si tu veux 30, 10, etc.)
const BONUS_COOLDOWN_DAYS = 30;

/**
 * Trigger à la création d'un participant :
 * - crédite automatiquement 25 crédits de bienvenue
 * - écrit un log dans credit_logs
 * - pose un flag system.signupBonusGranted pour éviter les doublons
 * - + doc credit_grants idempotent (reçu)
 */
export const onParticipantCreate = onDocumentCreated(
  "participants/{uid}",
  async (event) => {
    const uid = event.params?.uid;
    if (!uid) return;

    logger.info("onParticipantCreate:start", { uid });

    const ref = db.collection("participants").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        logger.info("onParticipantCreate:noDoc", { uid });
        return;
      }

      const data = snap.data() || {};
      const system = data.system || {};

      // 🔒 Idempotence (flag)
      if (system.signupBonusGranted === true) {
        logger.info("onParticipantCreate:signupBonusAlreadyGranted", { uid });
        return;
      }

      const amount = SIGNUP_BONUS_AMOUNT;

      // 🔒 Idempotence (reçu) — double sécurité contre retry/duplication
      const grantId = `signup_${uid}`;

      const res = await grantCreditsTx(tx, {
        uid,
        amount,
        grantId,
        source: "signup_bonus",
        meta: {
          reason: "NEW_PARTICIPANT_WELCOME",
        },
      });

      // Si déjà octroyé (grant existant), on pose quand même le flag pour aligner l’état
      if (res.reason === "already_granted") {
        tx.set(
          ref,
          {
            system: {
              signupBonusGranted: true,
              signupBonusAmount: amount,
              signupBonusAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return;
      }

      // Marquer le bonus comme octroyé
      if (res.applied) {
        tx.set(
          ref,
          {
            system: {
              signupBonusGranted: true,
              signupBonusAmount: amount,
              signupBonusAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    });

    logger.info("onParticipantCreate:done", { uid, amount: SIGNUP_BONUS_AMOUNT });
  }
);

/**
 * Bonus gratuit : max 1 fois tous les BONUS_COOLDOWN_DAYS jours.
 * Bouton "+25 Bonus" côté client.
 *
 * NOTE: on garde ton quotaRef (source de vérité du cooldown),
 *       et on ajoute un credit_grant idempotent pour éviter les doublons (retry / double tap).
 */
export const freeTopUp = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

  const amountRaw = req.data?.amount ?? req.data?.delta ?? 25;
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "amount must be > 0");
  }

  const todayYmd = toYmdInTz(new Date(), APP_TZ); // "YYYY-MM-DD"

  const ref = db.collection("participants").doc(uid);
  const quotaRef = ref.collection("system").doc("daily_bonus");

  await db.runTransaction(async (tx) => {
    const qSnap = await tx.get(quotaRef);
    const q = qSnap.exists ? qSnap.data() || {} : {};

    const nextAvailableYmd = q.nextAvailableYmd || null; // "YYYY-MM-DD"

    // ✅ Bloqué si aujourd'hui est avant la date de dispo
    if (nextAvailableYmd && todayYmd < nextAvailableYmd) {
      throw new HttpsError(
        "failed-precondition",
        `Tu as déjà utilisé ton bonus récemment. Tu pourras redemander le ${nextAvailableYmd}.`,
        { nextAvailableDay: nextAvailableYmd }
      );
    }

    // ✅ Idempotence par jour (protège double tap/retry)
    const grantId = `freeTopup_${uid}_${todayYmd}`;

    // 👉 Ici tu appelles ton helper grantCreditsTx(tx, {...})
    // (comme dans ton refactor)
    await grantCreditsTx(tx, {
      uid,
      amount,
      grantId,
      source: "topup_free",
      meta: { day: todayYmd, cooldownDays: BONUS_COOLDOWN_DAYS },
    });

    // ✅ Set prochain jour disponible
    const nextYmd = addDaysToYmd(todayYmd, BONUS_COOLDOWN_DAYS);

    tx.set(
      quotaRef,
      {
        lastDay: todayYmd,
        nextAvailableYmd: nextYmd,
        lastTopUpAt: FieldValue.serverTimestamp(),
        cooldownDays: BONUS_COOLDOWN_DAYS,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { ok: true, amount, nextAvailableDay: null };
});