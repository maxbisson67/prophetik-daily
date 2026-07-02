import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { resolveLeaderboardReadKeys, competitionKeyMatchesSport } from "@src/season/seasonCompetitionCore";

function mergeLeaderboardRows(rowsByKey) {
  const merged = new Map();
  for (const rows of Object.values(rowsByKey)) {
    for (const row of rows || []) {
      const id = String(row.uid || row.id || "").trim();
      if (!id) continue;
      const pts = Number(row.pointsTotal ?? 0) || 0;
      const prev = merged.get(id);
      if (!prev || pts >= Number(prev.pointsTotal ?? 0)) {
        merged.set(id, { ...row, id });
      }
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => Number(b.pointsTotal ?? 0) - Number(a.pointsTotal ?? 0)
  );
}

export default function useLeaderboardGroupMembers({
  groupId,
  seasonId,
  competitionKey,
  sport,
  enabled,
}) {
  const leaderboardKey = String(competitionKey || seasonId || "").trim();
  const sportKeyMatches = !sport || competitionKeyMatchesSport(leaderboardKey, sport);
  const effectiveEnabled = !!enabled && sportKeyMatches;
  const readKeys = useMemo(
    () => resolveLeaderboardReadKeys(leaderboardKey),
    [leaderboardKey]
  );

  const [rowsByKey, setRowsByKey] = useState({});
  const [loading, setLoading] = useState(!!effectiveEnabled);

  useEffect(() => {
    let alive = true;

    if (!effectiveEnabled || !leaderboardKey || !groupId) {
      setRowsByKey({});
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setRowsByKey({});
    setLoading(true);
    const gid = String(groupId);
    const unsubs = [];

    for (const key of readKeys) {
      const q = firestore()
        .collection(`groups/${gid}/leaderboards/${key}/members`)
        .orderBy("pointsTotal", "desc")
        .limit(50);

      unsubs.push(
        q.onSnapshot(
          (snap) => {
            if (!alive) return;
            setRowsByKey((prev) => ({
              ...prev,
              [key]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
            }));
            setLoading(false);
          },
          (err) => {
            if (!alive) return;
            console.log("[LB] ERROR", err?.code, err?.message);
            setRowsByKey((prev) => ({ ...prev, [key]: [] }));
            setLoading(false);
          }
        )
      );
    }

    return () => {
      alive = false;
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [effectiveEnabled, leaderboardKey, groupId, readKeys.join("|")]);

  const rows = useMemo(() => {
    const scoped = {};
    for (const key of readKeys) {
      scoped[key] = rowsByKey[key] || [];
    }
    return mergeLeaderboardRows(scoped);
  }, [rowsByKey, readKeys.join("|")]);

  return { rows, loading };
}
