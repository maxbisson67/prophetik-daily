// src/ascensions/hooks/useAscensionGlobalState.js
import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

export default function useAscensionGlobalState({ groupId, ascKey }) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  const key = useMemo(() => `${String(groupId || "")}:${String(ascKey || "")}`, [groupId, ascKey]);

  useEffect(() => {
    setState(null);
    setError(null);

    if (!groupId || !ascKey) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore()
      .collection("groups")
      .doc(String(groupId))
      .collection("ascensions")
      .doc(String(ascKey).toUpperCase());

    const un = ref.onSnapshot(
      (snap) => {
        if (!snap.exists) {
          setState(null);
          setLoading(false);
          return;
        }
        const d = snap.data() || {};
        setState({
          id: snap.id,
          enabled: d.enabled !== false,
          stepsTotal: Number(d.stepsTotal || (String(ascKey).toUpperCase() === "ASC7" ? 7 : 4)),
          cycleId: d.cycleId || null,
          cycleIndex: Number(d.cycleIndex || 1),
          cycleStartYmd: d.cycleStartYmd || null,
          cycleEndYmd: d.cycleEndYmd || null,
          nextGameYmd: d.nextGameYmd || null,
          lastCreatedGameYmd: d.lastCreatedGameYmd || null,
          lastDefiIdByStep: d.lastDefiIdByStep || {},
          completedWinners: safeArr(d.completedWinners),
          completedAt: d.completedAt || null,
          lastTickNote: d.lastTickNote || null,
          lastFinalizeAt: d.lastFinalizeAt || null,
          lastFinalizeDefiId: d.lastFinalizeDefiId || null,
          lastFinalizeStepType: d.lastFinalizeStepType || null,
          updatedAt: d.updatedAt || null,
        });
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );

    return () => {
      try { un(); } catch {}
    };
  }, [key]);

  return { loading, state, error };
}