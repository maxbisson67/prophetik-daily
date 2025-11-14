// src/credits/api.js
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

/** Normalise le solde de crédits selon divers schémas possibles */
function readCredits(docData) {
  const d = docData || {};
  if (typeof d.credits === 'number') return d.credits;
  if (typeof d.balance === 'number') return d.balance;
  if (d.credits && typeof d.credits === 'object') {
    if (typeof d.credits.balance === 'number') return d.credits.balance;
    if (typeof d.credits.total === 'number' && typeof d.credits.spent === 'number') {
      return d.credits.total - d.credits.spent;
    }
  }
  if (d.wallets?.main && typeof d.wallets.main.balance === 'number') {
    return d.wallets.main.balance;
  }
  if (typeof d.creditBalance === 'number') return d.creditBalance;

  // strings → number
  const candidates = [
    d.credits, d.balance, d?.credits?.balance, d?.wallets?.main?.balance, d.creditBalance,
  ].filter((v) => typeof v === 'string');
  for (const s of candidates) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Abonnement au solde de crédits (participants/{uid}.credits|balance|…) */
export function subscribeCredits(uid, cb) {
  if (!uid || typeof cb !== 'function') return () => {};
  const ref = firestore().doc(`participants/${uid}`);
  const unsubscribe = ref.onSnapshot(
    (snap) => cb(snap.exists ? readCredits(snap.data()) : 0),
    () => cb(0)
  );
  return unsubscribe;
}

/** Appelle la CF freeTopUp (ajoute +25 si autorisé) */
export async function freeTopUp() {
  const call = functions().httpsCallable('freeTopUp');
  const res = await call({});
  // attendu: { ok: boolean, credits: number }
  return res?.data ?? { ok: false };
}

/** Rejoindre un défi (débite stakes) */
export async function joinDefi(groupId, defiId) {
  const call = functions().httpsCallable('joinDefi');
  const res = await call({ groupId, defiId });
  // attendu: { ok, credits, alreadyJoined? }
  return res?.data ?? { ok: false };
}

/** Clôturer un défi */
export async function closeDefi(groupId, defiId, winners) {
  const call = functions().httpsCallable('closeDefi');
  const res = await call({ groupId, defiId, winners });
  // attendu: { ok, gainPerWinner, totalPot }
  return res?.data ?? { ok: false };
}