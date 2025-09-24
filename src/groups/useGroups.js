// src/groups/useGroups.js
import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';

export function useGroups(uid) {
  const [state, setState] = useState({ loading: true, error: null, groups: [] });

  useEffect(() => {
    if (!uid) {
      setState({ loading: false, error: null, groups: [] });
      return;
    }
    const q = query(collection(db, 'group_memberships'), where('userId', '==', uid), where('active', '==', true));
    const unsub = onSnapshot(q, async (snap) => {
      try {
        const memberships = snap.docs.map(d => d.data());
        const hydrated = await Promise.all(memberships.map(async (m) => {
          const gRef = doc(db, 'groups', m.groupId);
          const gDoc = await getDoc(gRef);
          const g = gDoc.exists() ? { id: gDoc.id, ...gDoc.data() } : { id: m.groupId, name: 'Groupe supprimé' };
          const balRef = doc(db, 'group_balances', `${m.groupId}_${uid}`);
          const balDoc = await getDoc(balRef);
          const balance = balDoc.exists() ? (balDoc.data().balance || 0) : 0;
          return { ...g, role: m.role, balance };
        }));
        setState({ loading: false, error: null, groups: hydrated });
      } catch (e) {
        setState({ loading: false, error: e, groups: [] });
      }
    }, (err) => setState({ loading: false, error: err, groups: [] }));

    return () => unsub();
  }, [uid]);

  return useMemo(() => ({ ...state, refresh: () => setState(s => ({ ...s })) }), [state]);
}