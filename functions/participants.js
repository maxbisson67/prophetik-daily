// functions/participants.js
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger, readAnyBalance } from "./utils.js";
import { DateTime } from 'luxon';
export const onParticipantCreate = onDocumentCreated("participants/{uid}", async (event) => {
  logger.info("onParticipantCreate", { uid: event.params.uid });
});

const TZ = 'America/Toronto';

export const freeTopUp = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

  const amountRaw = req.data?.amount ?? req.data?.delta ?? 25;
  const amount = Number(amountRaw);
  if (!(amount > 0)) throw new HttpsError("invalid-argument", "amount must be > 0");

  const ref = db.collection("participants").doc(uid);
  const quotaRef = ref.collection('system').doc('daily_bonus');
  const today = DateTime.now().setZone(TZ).toFormat('yyyy-LL-dd');
  await db.runTransaction(async (tx) => {
    const qSnap = await tx.get(quotaRef);
    if (qSnap.exists && qSnap.data()?.lastDay === today) {
      throw new HttpsError('failed-precondition', 'Daily bonus already claimed today');
    }
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() || {}) : {};
    const curBal = readAnyBalance(cur);
    const newBal = curBal + amount;

    tx.set(ref, { credits: { balance: newBal, updatedAt: FieldValue.serverTimestamp() } }, { merge: true });
    const logRef = ref.collection("credit_logs").doc();
    tx.set(logRef, {
      type: "topup_free",
      amount,
      fromBalance: curBal,
      toBalance: newBal,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(quotaRef, { lastDay: today, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true };
});