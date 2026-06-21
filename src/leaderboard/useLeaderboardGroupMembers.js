import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";

export default function useLeaderboardGroupMembers({ groupId, seasonId, enabled }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!!enabled);

  useEffect(() => {
    if (!enabled || !seasonId || !groupId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const base = firestore().collection(
      `groups/${String(groupId)}/leaderboards/${seasonId}/members`
    );
    const q = base.orderBy("pointsTotal", "desc").limit(50);

    const un = q.onSnapshot(
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.log("[LB] ERROR", err?.code, err?.message);
        setLoading(false);
      }
    );

    return () => {
      try {
        un?.();
      } catch {}
    };
  }, [enabled, seasonId, groupId]);

  return { rows, loading };
}
