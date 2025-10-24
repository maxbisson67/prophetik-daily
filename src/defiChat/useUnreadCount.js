import { useEffect, useState, useCallback } from 'react';
import { db } from '@src/lib/firebase';
import {
  doc, getDoc, collection, query, where, getCountFromServer, onSnapshot, orderBy, limit
} from 'firebase/firestore';

export function useUnreadCount(defiId, uid) {
  const [count, setCount] = useState(0);

  const compute = useCallback(async () => {
    if (!defiId || !uid) return setCount(0);
    // 1) lire le pointeur lastSeen
    const readRef = doc(db, 'defis', String(defiId), 'reads', uid);
    const readSnap = await getDoc(readRef);
    const lastSeen = readSnap.exists() ? readSnap.data()?.lastSeenAt : null;

    // 2) compter les messages > lastSeen (si pas de lastSeen, on peut décider d’afficher 0 ou tout)
    const msgsRef = collection(db, 'defis', String(defiId), 'messages');
    let q;
    if (lastSeen?.toMillis) {
      q = query(msgsRef, where('createdAt', '>', lastSeen));
    } else {
      // Première fois : ne pas “spammer” => 0. Si tu veux tout compter, supprime ce return.
      setCount(0);
      return;
    }
    const snap = await getCountFromServer(q);
    setCount(snap.data().count || 0);
  }, [defiId, uid]);

  useEffect(() => {
    compute();

    // bonus: si un nouveau message arrive, on recalcule (écoute le dernier message)
    if (!defiId) return;
    const unsub = onSnapshot(
      query(
        collection(db, 'defis', String(defiId), 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      ),
      () => compute()
    );
    return () => unsub();
  }, [defiId, compute]);

  return count;
}