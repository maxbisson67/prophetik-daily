// src/leaderboard/hooks/usePublicProfilesFor.js
import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

export default function usePublicProfilesFor(uids) {
  const [map, setMap] = useState({}); // uid -> { displayName, avatarUrl, updatedAt }

  useEffect(() => {
    const ids = Array.from(new Set((uids || []).filter(Boolean).map(String)));
    if (!ids.length) {
      setMap({});
      return;
    }

    const unsubs = new Map();

    ids.forEach((uid) => {
      if (unsubs.has(uid)) return;

      const ref = firestore().collection('profiles_public').doc(uid);
      const un = ref.onSnapshot(
        (snap) => {
          if (!snap.exists) {
            setMap((prev) => {
              if (!prev[uid]) return prev;
              const next = { ...prev };
              delete next[uid];
              return next;
            });
            return;
          }

          const d = snap.data() || {};
          setMap((prev) => ({
            ...prev,
            [uid]: {
              displayName: d.displayName || 'Invité',
              avatarUrl: d.avatarUrl || null,
              updatedAt: d.updatedAt || null,
            },
          }));
        },
        () => {}
      );

      unsubs.set(uid, un);
    });

    return () => {
      for (const [, un] of unsubs) {
        try { un?.(); } catch {}
      }
    };
  }, [JSON.stringify(uids || [])]);

  return map;
}