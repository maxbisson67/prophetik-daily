// src/defis/useDefis.js (version RNFB)
import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

/**
 * Souscrit en temps réel aux défis d’un groupe.
 * Options possibles : orderBy('createdAt','desc'), filtre de statut, etc.
 */
export function useGroupDefis(groupId, { status } = {}) {
  const [defis, setDefis]   = useState([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!groupId) {
      setDefis([]);
      setLoading(false);
      setError(null);
      return;
    }

    let q = firestore()
      .collection('defis')
      .where('groupId', '==', String(groupId));

    if (status) q = q.where('status', '==', String(status));
    // Optionnel : trier (nécessite parfois un index composite si combiné à where)
    q = q.orderBy('createdAt', 'desc');

    const unsub = q.onSnapshot(
      (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDefis(rows);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    return () => { try { unsub(); } catch {} };
  }, [groupId, status]);

  return { defis, loading, error };
}

/**
 * Souscrit à MA participation dans un défi donné
 * defis/{defiId}/participations/{uid}
 */
export function useMyDefiParticipation(defiId, uid) {
  const [participation, setParticipation] = useState(null);
  const [loading, setLoading] = useState(!!(defiId && uid));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!defiId || !uid) {
      setParticipation(null);
      setLoading(false);
      setError(null);
      return;
    }

    const ref = firestore().doc(`defis/${String(defiId)}/participations/${String(uid)}`);

    const unsub = ref.onSnapshot(
      (snap) => {
        setParticipation(snap.exists ? ({ id: snap.id, ...snap.data() }) : null);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    return () => { try { unsub(); } catch {} };
  }, [defiId, uid]);

  return { participation, loading, error };
}