import { useEffect, useState, useCallback } from 'react';
import { db } from '@src/lib/firebase';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, setDoc
} from 'firebase/firestore';
import { useAuth } from '@src/auth/AuthProvider';

export function useDefiChat(defiId, pageSize = 50) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!defiId) return;
    const ref = collection(db, 'defis', String(defiId), 'messages');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(pageSize));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [defiId, pageSize]);

  const send = useCallback(async (text) => {
    if (!user?.uid || !text?.trim()) return;
    const ref = collection(db, 'defis', String(defiId), 'messages');
    setBusy(true);
    try {
      await addDoc(ref, {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Anonyme',
        photoURL: profile?.photoURL || user.photoURL || null,
        text: text.trim(),
        type: 'text',
        createdAt: serverTimestamp(),
      });
    } finally { setBusy(false); }
  }, [defiId, user?.uid, profile?.displayName, profile?.photoURL, user?.displayName, user?.photoURL]);

  // Marque “lu” (timestamp) pour ce défi
  const markRead = useCallback(async () => {
    if (!user?.uid || !defiId) return;
    const r = doc(db, 'defis', String(defiId), 'reads', user.uid);
    await setDoc(r, { lastSeenAt: serverTimestamp(), lastOpenAt: serverTimestamp() }, { merge: true });
  }, [defiId, user?.uid]);

  return { messages, send, busy, markRead };
}