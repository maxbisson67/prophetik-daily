// src/leaderboard/useLeaderboardSeason.js
import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

function normalizeMember(docId, data) {
  const d = data || {};
  return {
    id: docId, // ✅ utile pour ta table
    uid: d.uid || docId,

    displayName: d.displayName || null,
    avatarUrl: d.avatarUrl || null, // si tu l’ajoutes plus tard

    participations: Number(d.participations || 0),
    wins: Number(d.wins || 0),
    winRate: Number(d.winRate || 0),

    potTotal: Number(d.potTotal || 0),
    pointsTotal: Number(d.pointsTotal || 0),

    winsByType: d.winsByType || {},

    updatedAt: d.updatedAt || null,
  };
}

export default function useLeaderboardSeason({ groupId, seasonId, limit = 200 }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canRun = !!groupId && !!seasonId;

  useEffect(() => {
    if (!canRun) {
      setRows([]);
      setMeta(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const metaRef = firestore().doc(`groups/${groupId}/leaderboards/${seasonId}`);
    const membersRef = firestore()
      .collection(`groups/${groupId}/leaderboards/${seasonId}/members`)
      // ✅ tri stable pour le classement (ajuste selon ton produit)
      .orderBy("wins", "desc")
      .orderBy("potTotal", "desc")
      .orderBy("participations", "desc")
      .limit(limit);

    const unsubMeta = metaRef.onSnapshot(
      (snap) => {
        setMeta(snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null);
      },
      (e) => setError(e)
    );

    const unsubMembers = membersRef.onSnapshot(
      (snap) => {
        const next = snap.docs.map((d) => normalizeMember(d.id, d.data()));
        setRows(next);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setRows([]);
        setLoading(false);
      }
    );

    return () => {
      unsubMeta?.();
      unsubMembers?.();
    };
  }, [canRun, groupId, seasonId, limit]);

  const out = useMemo(() => ({ rows, meta, loading, error }), [rows, meta, loading, error]);
  return out;
}