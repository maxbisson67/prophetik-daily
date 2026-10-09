import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import {
  resolveLeaderboardReadKeys,
  competitionKeyMatchesSport,
} from "@src/season/seasonCompetitionCore";
import {
  mergeLeaderboardRows,
  mergeMembersWithLeaderboardRows,
  isActiveGroupMembership,
} from "./leaderboardMemberMerge";

const MEMBER_DOC_LIMIT = 200;

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
  const [memberUids, setMemberUids] = useState([]);
  const [loading, setLoading] = useState(!!effectiveEnabled);

  useEffect(() => {
    let alive = true;

    if (!effectiveEnabled || !leaderboardKey || !groupId) {
      setRowsByKey({});
      setMemberUids([]);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setRowsByKey({});
    setMemberUids([]);
    setLoading(true);
    const gid = String(groupId);
    const unsubs = [];

    for (const key of readKeys) {
      const q = firestore()
        .collection(`groups/${gid}/leaderboards/${key}/members`)
        .limit(MEMBER_DOC_LIMIT);

      unsubs.push(
        q.onSnapshot(
          (snap) => {
            if (!alive) return;
            setRowsByKey((prev) => ({
              ...prev,
              [key]: (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() })),
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

    unsubs.push(
      firestore()
        .collection("group_memberships")
        .where("groupId", "==", gid)
        .onSnapshot(
          (snap) => {
            if (!alive) return;
            const uids = (snap?.docs ?? [])
              .map((d) => {
                const data = d.data() || {};
                if (!isActiveGroupMembership(data)) return null;
                return (
                  String(data.uid || data.userId || data.participantId || "").trim() ||
                  null
                );
              })
              .filter(Boolean);
            setMemberUids(Array.from(new Set(uids)));
          },
          () => {
            if (!alive) return;
            setMemberUids([]);
          }
        )
    );

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
    const leaderboardRows = mergeLeaderboardRows(scoped, readKeys);
    return mergeMembersWithLeaderboardRows(memberUids, leaderboardRows);
  }, [rowsByKey, readKeys.join("|"), memberUids.join("|")]);

  return { rows, loading };
}
