// functions/gamification/utils.js
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';

const db = getFirestore();
const TZ = 'America/Toronto';

/** Returns today's date as YYYY-MM-DD in America/Toronto */
export function todayLocalISO(date = new Date()) {
  try {
    return DateTime.fromJSDate(date, { zone: TZ }).toFormat('yyyy-LL-dd');
  } catch {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
}

/**
 * Idempotent credit award with ledger entry written to **credit_logs**.
 * - Transaction writes a row to participants/{uid}/credit_logs/{idempotencyKey}
 *   with fields: { amount, type, fromBalance, toBalance, groupId, defiId, idempotencyKey, createdAt }
 * - Also increments participants/{uid}.credits.balance
 * - If groupId provided, updates groups/{groupId}/leaderboard/{uid}.balance
 */
export async function awardCredit({
  uid,
  delta,
  reason,
  meta = {},
  idempotencyKey,
  groupId = null,
  defiId = null,
}) {
  if (!uid || !delta || !reason) throw new Error('awardCredit: missing params');
  const ledgerId = idempotencyKey || `${reason}:${defiId || groupId || 'none'}:${uid}`;

  const pRef = db.collection('participants').doc(uid);
  const lRef = pRef.collection('credit_logs').doc(ledgerId); // ← credit_logs (existing collection)

  await db.runTransaction(async (tx) => {
    const lSnap = await tx.get(lRef);
    if (lSnap.exists) return; // already credited

    const pSnap = await tx.get(pRef);
    const currentBalance = pSnap.exists ? (pSnap.data()?.credits?.balance ?? 0) : 0;
    const fromBalance = currentBalance;
    const toBalance = fromBalance + delta;

    tx.set(lRef, {
      amount: delta,
      type: reason,
      ref: meta.ref || null,
      groupId,
      defiId,
      fromBalance,
      toBalance,
      idempotencyKey: ledgerId,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      pRef,
      {
        credits: { balance: FieldValue.increment(delta) },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (groupId) {
      const gRef = db.collection('groups').doc(groupId).collection('leaderboard').doc(uid);
      tx.set(
        gRef,
        {
          uid,
          balance: FieldValue.increment(delta),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });
}