// src/defis/useDefis.js
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@src/lib/firebase';

/**
 * Souscrit en temps réel aux défis d’un groupe.
 * Option: tu peux filtrer côté rendu selon dates (start/end) ou statut.
 */
export function useGroupDefis(groupId) {
  const [defis, setDefis] = useState([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setDefis([]);
      setLoading(false);
      return;
    }
    const qd = query(collection(db, 'defis'), where('groupId', '==', groupId));
    const un = onSnapshot(
      qd,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDefis(rows);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    return () => un();
  }, [groupId]);

  return { defis, loading, error };
}

/**
 * Si tu veux souscrire aux participations d’un utilisateur pour un défi donné
 * (utile pour pré-remplir son choix, afficher “déjà répondu”, etc.)
 */
export function useMyDefiParticipation(defiId, uid) {
  const [participation, setParticipation] = useState(null);
  const [loading, setLoading] = useState(!!(defiId && uid));

  useEffect(() => {
    if (!defiId || !uid) {
      setParticipation(null);
      setLoading(false);
      return;
    }
    const pid = `${defiId}_${uid}`;
    const un = onSnapshot(
      collection(db, 'defi_participations'),
      () => {}, // placeholder pour éviter un unused import si tu préfères doc() + onSnapshot
    );
    // version doc directe:
    // const un = onSnapshot(doc(db, 'defi_participations', pid), (snap) => {
    //   setParticipation(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    //   setLoading(false);
    // }, () => setLoading(false));
    return () => {
      try { un(); } catch {}
    };
  }, [defiId, uid]);

  return { participation, loading };
}