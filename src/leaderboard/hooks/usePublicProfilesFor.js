// src/leaderboard/hooks/usePublicProfilesFor.js
import { useEffect, useState } from 'react';
import { snapshotExists, snapshotData } from "@src/lib/safeSnapshot";
import firestore from '@react-native-firebase/firestore';

export default function usePublicProfilesFor(uids) {
  const [map, setMap] = useState({});

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
          if (!snap || !snapshotExists(snap)) return;

          const d = snapshotData(snap) || {};
          setMap((prev) => ({
            ...prev,
            [uid]: {
              displayName: d.displayName || 'Invité',
              avatarUrl: d.avatarUrl || d.jerseyFrontUrl || null,
              jerseyFrontUrl: d.jerseyFrontUrl || null,
              jerseyBackUrl: d.jerseyBackUrl || null,
              avatarKind: d.avatarKind || null,
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