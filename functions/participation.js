// functions/participation.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, readAnyBalance, numOrNull } from "./utils.js";

export const participateInDefi = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required");

  const defiId = String(req.data?.defiId || "");
  if (!defiId) throw new HttpsError("invalid-argument", "defiId required");

  const picks = Array.isArray(req.data?.picks) ? req.data.picks : [];

  const dRef = db.collection("defis").doc(defiId);
  const pRef = dRef.collection("participations").doc(uid);
  const uRef = db.collection("participants").doc(uid);

  let returnPayload = { ok: true, newPot: null, newBalance: null, alreadyPaid: false };

  await db.runTransaction(async (tx) => {
    const [dSnap, pSnap, uSnap] = await Promise.all([tx.get(dRef), tx.get(pRef), tx.get(uRef)]);
    if (!dSnap.exists) throw new HttpsError("not-found", "defi not found");

    const d = dSnap.data() || {};
    const status = String(d.status || "open").toLowerCase();
    if (status !== "open") throw new HttpsError("failed-precondition", "defi is not open");

    const already = pSnap.exists ? (pSnap.data() || {}) : null;
    const alreadyPaid = already?.paid === true;

    const costRaw = d.participationCost ?? d.type ?? 0;
    const cost = Number(costRaw);
    if (!Number.isFinite(cost) || cost < 0) throw new HttpsError("failed-precondition", "invalid participation cost");

    const curU = uSnap.exists ? (uSnap.data() || {}) : {};
    const currentBalance = readAnyBalance(curU);
    if (!alreadyPaid && currentBalance < cost) throw new HttpsError("failed-precondition", "insufficient credits");

    const now = FieldValue.serverTimestamp();
    tx.set(
      pRef,
      {
        picks,
        joinedAt: now,
        ...(alreadyPaid ? {} : { paid: true, paidAmount: cost, paidAt: now }),
      },
      { merge: true }
    );

    const incParticipants = already ? 0 : 1;
    tx.set(
      dRef,
      {
        ...(alreadyPaid ? {} : { pot: FieldValue.increment(cost) }),
        ...(incParticipants ? { participantsCount: FieldValue.increment(1) } : {}),
        updatedAt: now,
      },
      { merge: true }
    );

    if (!alreadyPaid && cost > 0) {
      const newBal = Math.max(0, currentBalance - cost);
      tx.set(uRef, { credits: { balance: newBal, updatedAt: now } }, { merge: true });
      const logRef = uRef.collection("credit_logs").doc();
      tx.set(logRef, {
        type: "defi_entry",
        amount: -cost,
        fromBalance: currentBalance,
        toBalance: newBal,
        defiId,
        createdAt: now,
      });
      returnPayload.newBalance = newBal;
    } else {
      returnPayload.newBalance = currentBalance;
    }

    const oldPot = Number(d.pot ?? 0);
    returnPayload.alreadyPaid = alreadyPaid;
    returnPayload.newPot = alreadyPaid ? oldPot : oldPot + cost;
  });

  return returnPayload;
});