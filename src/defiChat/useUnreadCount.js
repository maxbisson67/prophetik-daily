// src/defiChat/useUnreadCount.js
import { useEffect, useState, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';

/**
 * useUnreadCount(defiId, uid, { useCollectionGroup = true, groupId })
 * - Compte les messages > lastSeenAt (hors messages envoyés par l’utilisateur)
 * - Version RN Firebase (firestore())
 */
export function useUnreadCount(defiId, uid, opts = {}) {
  const { useCollectionGroup = true, groupId } = opts;
  const [count, setCount] = useState(0);

  const compute = useCallback(async () => {
    try {
      if (!defiId || !uid) { setCount(0); return; }
      if (useCollectionGroup && !groupId) { setCount(0); return; }

      // 1) lastSeenAt
      const readRef = firestore().doc(`defis/${String(defiId)}/reads/${String(uid)}`);
      const readSnap = await readRef.get();
      const lastSeenAt = readSnap.exists ? readSnap.data()?.lastSeenAt : null;
      if (!lastSeenAt?.toMillis) { setCount(0); return; }

      // 2) Requêtes > lastSeenAt
      if (useCollectionGroup) {
        const base = firestore().collectionGroup('messages');
        const qTotal = base
          .where('groupId', '==', String(groupId))
          .where('createdAt', '>', lastSeenAt)
          .orderBy('createdAt', 'asc');

        const qMine = base
          .where('groupId', '==', String(groupId))
          .where('createdAt', '>', lastSeenAt)
          .where('uid', '==', String(uid))
          .orderBy('createdAt', 'asc');

        const [snapTotal, snapMine] = await Promise.all([qTotal.get(), qMine.get()]);
        const total = snapTotal.size || 0;
        const mine  = snapMine.size || 0;

        setCount(Math.max(0, total - mine));
      } else {
        // Pas de fallback per-défi (évite les index composites spécifiques)
        setCount(0);
      }
    } catch (e) {
      console.warn('[useUnreadCount] compute error:', e?.code || e?.message || e);
      setCount(0);
    }
  }, [defiId, uid, useCollectionGroup, groupId]);

  useEffect(() => {
    compute();

    if (!defiId) return;
    if (useCollectionGroup && !groupId) return;

    // Écoute “tick” minimaliste : on surveille le dernier message du groupe,
    // et on relance compute() à chaque nouveau message.
    let unsub = () => {};
    if (useCollectionGroup) {
      const qCG = firestore()
        .collectionGroup('messages')
        .where('groupId', '==', String(groupId))
        .orderBy('createdAt', 'asc')
        .limitToLast(1);

      unsub = qCG.onSnapshot(
        () => compute(),
        (err) => console.warn('[useUnreadCount] CG onSnapshot error:', err?.code || err?.message || err)
      );
    }
    return () => { try { unsub(); } catch {} };
  }, [defiId, groupId, useCollectionGroup, compute]);

  return count;
}