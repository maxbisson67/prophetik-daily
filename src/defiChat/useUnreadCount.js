// src/defiChat/useUnreadCount.js
import { useEffect, useState, useCallback } from 'react';
import { db } from '@src/lib/firebase';
import {
  doc, getDoc, limitToLast , collectionGroup, query, where, orderBy,
  onSnapshot, getCountFromServer
} from 'firebase/firestore';

export function useUnreadCount(defiId, uid, opts = {}) {
  const {
    useCollectionGroup = true,
    groupId,
  } = opts;

  const [count, setCount] = useState(0);

  const compute = useCallback(async () => {
    try {
      if (!defiId || !uid) { setCount(0); return; }

      // ✅ Si on utilise CG, on attend que groupId soit dispo (pas de fallback per-défi)
      if (useCollectionGroup && !groupId) { setCount(0); return; }

      // 1) lastSeen
      const readRef = doc(db, 'defis', String(defiId), 'reads', String(uid));
      const readSnap = await getDoc(readRef);
      const lastSeenAt = readSnap.exists() ? readSnap.data()?.lastSeenAt : null;
      if (!lastSeenAt?.toMillis) { setCount(0); return; }

      // 2) build queries
      const afterSeen = where('createdAt', '>', lastSeenAt);
      let qTotal, qMine;

      if (useCollectionGroup) {
        const base = collectionGroup(db, 'messages');
        qTotal = query(
         base,
         where('groupId', '==', String(groupId)),
         where('createdAt', '>', lastSeenAt),
         orderBy('createdAt', 'asc')
       );
       qMine  = query(
         base,
         where('groupId', '==', String(groupId)),
         where('createdAt', '>', lastSeenAt),
         where('uid', '==', String(uid)),
         orderBy('createdAt', 'asc')
       );
      } else {
        // (Optionnel) si tu veux absolument le fallback un jour, tu pourras le remettre,
        // mais c'est lui qui demande l'index composite per-défi et provoquait failed-precondition.
        setCount(0);
        return;
      }

      const [snapTotal, snapMine] = await Promise.all([
        getCountFromServer(qTotal),
        getCountFromServer(qMine),
      ]);

      const total = Number(snapTotal.data().count || 0);
      const mine  = Number(snapMine.data().count || 0);
      setCount(Math.max(0, total - mine));
    } catch (e) {
      console.warn('[useUnreadCount] compute error:', e?.code || e?.message || e);
      setCount(0);
    }
  }, [defiId, uid, useCollectionGroup, groupId]);

  useEffect(() => {
    compute();

    if (!defiId) return;
    if (useCollectionGroup && !groupId) return; // pas d'écoute tant que groupId inconnu

    let unsub = () => {};
    if (useCollectionGroup) {
      const qCG = query(
        collectionGroup(db, 'messages'),
       where('groupId', '==', String(groupId)),
       orderBy('createdAt', 'asc'),
       limitToLast(1)
     );
      unsub = onSnapshot(qCG, () => compute(), (err) => {
        console.warn('[useUnreadCount] CG onSnapshot error:', err?.code || err?.message || err);
      });
    }
    return () => unsub();
  }, [defiId, groupId, useCollectionGroup, compute]);

  return count;
}