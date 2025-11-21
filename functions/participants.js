// functions/participants.js
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger, readAnyBalance } from "./utils.js";
import { DateTime } from "luxon";

const TZ = "America/Toronto";
const SIGNUP_BONUS_AMOUNT = 25;
const BONUS_COOLDOWN_DAYS = 10; // 🔥 1 bonus par 10 jours

/**
 * Trigger à la création d'un participant :
 * - crédite automatiquement 25 crédits de bienvenue
 * - écrit un log dans credit_logs
 * - pose un flag system.signupBonusGranted pour éviter les doublons
 */
export const onParticipantCreate = onDocumentCreated("participants/{uid}", async (event) => {
  const uid = event.params?.uid;
  if (!uid) return;

  logger.info("onParticipantCreate:start", { uid });

  const ref = db.collection("participants").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      // Document supprimé ou inexistant, rien à faire
      logger.info("onParticipantCreate:noDoc", { uid });
      return;
    }

    const data = snap.data() || {};
    const system = data.system || {};

    // 🔒 Idempotence : si déjà crédité, on sort
    if (system.signupBonusGranted === true) {
      logger.info("onParticipantCreate:signupBonusAlreadyGranted", { uid });
      return;
    }

    const curBal = readAnyBalance(data); // lit credits.balance ou autres formes
    const amount = SIGNUP_BONUS_AMOUNT;
    const newBal = curBal + amount;

    // Mise à jour du participant
    tx.set(
      ref,
      {
        credits: {
          balance: newBal,
          updatedAt: FieldValue.serverTimestamp(),
        },
        system: {
          // on garde l'ancien contenu de system grâce à { merge: true } au niveau du set global
          signupBonusGranted: true,
          signupBonusAmount: amount,
          signupBonusAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Log de crédit de bienvenue
    const logRef = ref.collection("credit_logs").doc();
    tx.set(logRef, {
      type: "signup_bonus",
      reason: "NEW_PARTICIPANT_WELCOME",
      amount,
      fromBalance: curBal,
      toBalance: newBal,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  logger.info("onParticipantCreate:signupBonusGranted", { uid, amount: SIGNUP_BONUS_AMOUNT });
});

/**
 * Bonus gratuit : max 1 fois tous les 10 jours.
 * Bouton "+25 Bonus" côté client.
 */
export const freeTopUp = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

  const amountRaw = req.data?.amount ?? req.data?.delta ?? 25;
  const amount = Number(amountRaw);
  if (!(amount > 0)) {
    throw new HttpsError("invalid-argument", "amount must be > 0");
  }

  const now = DateTime.now().setZone(TZ);
  const todayStr = now.toFormat("yyyy-LL-dd");

  const ref = db.collection("participants").doc(uid);
  // On réutilise la même doc, même si son nom est encore "daily_bonus"
  const quotaRef = ref.collection("system").doc("daily_bonus");

  await db.runTransaction(async (tx) => {
    const qSnap = await tx.get(quotaRef);
    if (qSnap.exists) {
      const q = qSnap.data() || {};
      const lastDay = q.lastDay; // "yyyy-LL-dd"

      if (lastDay) {
        const last = DateTime.fromISO(lastDay, { zone: TZ }).startOf("day");
        const today = DateTime.fromISO(todayStr, { zone: TZ }).startOf("day");
        const diffDays = Math.floor(today.diff(last, "days").days); // today - last

        if (diffDays < BONUS_COOLDOWN_DAYS) {
          const next = last.plus({ days: BONUS_COOLDOWN_DAYS });
          const nextAvailableDayStr = next.toFormat("yyyy-LL-dd");
          throw new HttpsError(
            "failed-precondition",
            `Tu as déjà utilisé ton bonus récemment. Tu pourras redemander le ${next.toFormat(
              "dd LLL yyyy"
            )}.`,
            {
              nextAvailableDay: nextAvailableDayStr,
            }
          );
        }
      }
    }

    // Ici → OK, on accorde le bonus
    const snap = await tx.get(ref);
    const cur = snap.exists ? snap.data() || {} : {};
    const curBal = readAnyBalance(cur);
    const newBal = curBal + amount;

    tx.set(
      ref,
      {
        credits: {
          balance: newBal,
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const logRef = ref.collection("credit_logs").doc();
    tx.set(logRef, {
      type: "topup_free",
      amount,
      fromBalance: curBal,
      toBalance: newBal,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      quotaRef,
      {
        lastDay: todayStr,
        lastTopUpAt: FieldValue.serverTimestamp(),
        cooldownDays: BONUS_COOLDOWN_DAYS,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  logger.info("freeTopUp:granted", { uid, amount });

  return {
    ok: true,
    amount,
    nextAvailableDay: null, // après succès, pas de blocage immédiat (le blocage est implicite côté serveur)
  };
});