// functions/credits/grantCredits.js
import { db, FieldValue } from "../utils.js";

export async function grantCreditsTx(tx, { uid, amount, grantId, source, meta = {} }) {
  if (!(amount > 0)) return { applied: false, reason: "amount<=0" };

  const pRef = db.doc(`participants/${uid}`);
  const gRef = db.doc(`credit_grants/${grantId}`);

  // idempotence
  const gSnap = await tx.get(gRef);
  if (gSnap.exists) return { applied: false, reason: "already_granted" };

  // lire balance pour log from/to (optionnel)
  const pSnap = await tx.get(pRef);
  const curBal = Number(pSnap.data()?.credits?.balance || 0);
  const newBal = curBal + amount;

  const nowTs = FieldValue.serverTimestamp();

  // écrire grant
  tx.set(gRef, {
    uid,
    source,
    amount,
    createdAt: nowTs,
    meta,
  });

  // incrémenter balance
  tx.set(
    pRef,
    {
      credits: {
        balance: FieldValue.increment(amount),
        updatedAt: nowTs,
      },
      updatedAt: nowTs,
    },
    { merge: true }
  );

  // log participant
function safeId(s, max = 80) {
  return String(s || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, max);
}

const logId = `${safeId(source, 40)}_${safeId(grantId, 40)}`;
const logRef = pRef.collection("credit_logs").doc(logId);
  tx.set(logRef, {
    type: source,
    amount,
    fromBalance: curBal,
    toBalance: newBal,
    createdAt: nowTs,
    meta,
  });

  return { applied: true, fromBalance: curBal, toBalance: newBal };
}