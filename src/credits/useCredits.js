// src/credits/useCredits.js
import { useEffect, useState, useCallback } from 'react';
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

/* Normalise le solde selon différents schémas possibles */
function readCredits(d) {
  if (!d) return 0;
  if (typeof d.credits === 'number') return d.credits;
  if (typeof d.balance === 'number') return d.balance;
  if (d.credits && typeof d.credits === 'object') {
    if (typeof d.credits.balance === 'number') return d.credits.balance;
    if (typeof d.credits.total === 'number' && typeof d.credits.spent === 'number') {
      return d.credits.total - d.credits.spent;
    }
  }
  if (typeof d.creditBalance === 'number') return d.creditBalance;
  if (d.wallets?.main && typeof d.wallets.main.balance === 'number') {
    return d.wallets.main.balance;
  }
  // strings -> number
  const candidates = [d.credits, d.balance, d?.credits?.balance, d?.wallets?.main?.balance, d.creditBalance]
    .filter((v) => typeof v === 'string');
  for (const s of candidates) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function useCredits() {
  const { user } = useAuth();
  const [credits, setCredits]   = useState(0);
  const [loading, setLoading]   = useState(!!user?.uid);
  const [error, setError]       = useState(null);

  // 🔄 Abonnement au document participant
  useEffect(() => {
    if (!user?.uid) { setCredits(0); setLoading(false); setError(null); return; }
    setLoading(true);
    const ref = firestore().doc(`participants/${user.uid}`);
    const unsub = ref.onSnapshot(
      (snap) => {
        setCredits(readCredits(snapshotExists(snap) ? snapshotData(snap) : null));
        setLoading(false);
      },
      (e) => { setError(e); setLoading(false); }
    );
    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  // ➕ Top-up “bêta” : CF freeTopUp -> fallback local (increment)
  const topUpFree = useCallback(async (amount = 25) => {
    if (!user?.uid) throw new Error('Not signed in');
    // 1) CF si dispo
    try {
      const call = functions().httpsCallable('freeTopUp');
      const res = await call({});
      if (res?.data?.ok) return res.data; // { ok, credits }
      // continue vers fallback si CF répond ok:false
    } catch (_) {
      // ignore & fallback
    }
    // 2) Fallback local (merge incrémental sur credits.balance)
    const ref = firestore().doc(`participants/${user.uid}`);
    await ref.set(
      { credits: { balance: firestore.FieldValue.increment(amount) } },
      { merge: true }
    );
    return { ok: true };
  }, [user?.uid]);

  // (optionnel) Débiter de façon sûre via transaction
  const spendIfEnough = useCallback(async (amount, meta = {}) => {
    if (!user?.uid) throw new Error('Not signed in');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be > 0');
    const ref = firestore().doc(`participants/${user.uid}`);
    return firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur  = readCredits(snapshotExists(snap) ? snapshotData(snap) : null);
      if (cur < amount) throw new Error('Crédits insuffisants');
      tx.set(ref, {
        credits: { balance: (cur - amount) }, // écriture explicite pour rester simple
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      // (facultatif) log
      if (meta?.type || meta?.reason) {
        const logRef = ref.collection('credit_logs').doc();
        tx.set(logRef, {
          type: meta.type || 'adjustment',
          reason: meta.reason || null,
          amount: -amount,
          fromBalance: cur,
          toBalance: cur - amount,
          createdAt: firestore.FieldValue.serverTimestamp(),
          ...(meta.defiId ? { defiId: meta.defiId } : {}),
        });
      }
      return { ok: true, from: cur, to: cur - amount };
    });
  }, [user?.uid]);

  return { credits, loading, error, topUpFree, spendIfEnough };
}