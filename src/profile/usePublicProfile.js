// src/profile/usePublicProfile.js (RNFB)
import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

const db = firestore();

/**
 * Abonnement temps réel au profil public d’un utilisateur.
 */
export function usePublicProfile(uid) {
  const [loading, setLoading] = useState(!!uid);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = db.collection('profiles_public').doc(String(uid));

    const unsubscribe = ref.onSnapshot(
      (snap) => {
        if (!snap.exists) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const d = snap.data() || {};
        setProfile({
          id: snap.id,
          displayName: d.displayName || 'Invité',
          avatarUrl: d.avatarUrl || null,
          avatarId: d.avatarId || null,
          updatedAt: d.updatedAt || null, // Timestamp Firestore
          visibility: d.visibility ?? 'public',
        });
        setLoading(false);
      },
      (error) => {
        console.warn('[usePublicProfile] onSnapshot error:', error);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubscribe?.();
      } catch {}
    };
  }, [uid]);

  return { profile, loading };
}