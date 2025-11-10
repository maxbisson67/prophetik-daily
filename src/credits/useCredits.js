// src/credits/useCredits.js
import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { db } from '@src/lib/firebase';

// ⬅️ IMPORTANT : utiliser le hook du SafeAuthProvider
import { useAuth } from '@src/auth/SafeAuthProvider';

export function useCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(!!user?.uid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) { setCredits(0); setLoading(false); setError(null); return; }
    setLoading(true);
    const ref = doc(db, 'participants', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data() || {};
      const val =
        typeof d.credits === 'number' ? d.credits :
        typeof d.credits?.balance === 'number' ? d.credits.balance :
        typeof d.balance === 'number' ? d.balance : 0;
      setCredits(Number(val || 0));
      setLoading(false);
    }, (e) => {
      setError(e);
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  // exemple simple de topUp (garde ton implémentation si tu as une CF)
  const topUpFree = async (amount = 25) => {
    if (!user?.uid) throw new Error('Not signed in');
    const ref = doc(db, 'participants', user.uid);
    // stocke sous credits.balance pour rester compatible avec tes règles
    await setDoc(ref, {
      credits: { balance: increment(amount) },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    // on laisse l’onSnapshot rafraîchir 'credits'
    return { ok: true };
  };

  return { credits, loading, error, topUpFree };
}