// src/leaderboard/hooks/useLeaderboards.js
import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

function normalizeRow(id, data) {
  const d = data || {};
  const uid = String(d.uid || id);

  return {
    id: uid,
    uid,

    displayName: d.displayName || null,

    wins: typeof d.wins === 'number' ? d.wins : 0,
    participations: typeof d.participations === 'number' ? d.participations : 0,

    potTotal: typeof d.potTotal === 'number' ? d.potTotal : 0,
    potAvg: typeof d.potAvg === 'number' ? d.potAvg : 0,

    pointsTotal: typeof d.pointsTotal === 'number' ? d.pointsTotal : 0,

    // VIP (si présent)
    winsByType: d.winsByType && typeof d.winsByType === 'object' ? d.winsByType : null,

    updatedAt: d.updatedAt || null,
  };
}

export default function useLeaderboards(groupIds) {
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState({});

  useEffect(() => {
    const gids = Array.from(new Set((groupIds || []).map(String).filter(Boolean)));

    if (!gids.length) {
      setAll({});
      setLoading(false);
      return;
    }

    let alive = true;
    const unsubs = [];
    const ready = new Set();

    setLoading(true);

    gids.forEach((gid) => {
      const ref = firestore()
        .collection('groups')
        .doc(String(gid))
        .collection('leaderboard')
        .limit(200);

      const unsub = ref.onSnapshot(
        (snap) => {
          const rows = snap.docs.map((d) => normalizeRow(d.id, d.data()));
          rows.sort((a, b) => (b.wins || 0) - (a.wins || 0));

          if (!alive) return;

          setAll((prev) => ({ ...prev, [gid]: rows }));
          ready.add(gid);
          if (ready.size === gids.length) setLoading(false);
        },
        (e) => {
          console.log('[Leaderboards]', gid, e?.code, e?.message);

          if (!alive) return;

          setAll((prev) => ({ ...prev, [gid]: [] }));
          ready.add(gid);
          if (ready.size === gids.length) setLoading(false);
        }
      );

      unsubs.push(unsub);
    });

    return () => {
      alive = false;
      unsubs.forEach((u) => {
        try { u?.(); } catch {}
      });
    };
  }, [JSON.stringify(groupIds || [])]);

  return { loading, all };
}