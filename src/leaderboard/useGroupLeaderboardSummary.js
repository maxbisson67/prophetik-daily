import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import {
  competitionKeyMatchesSport,
  resolveLeaderboardReadKeys,
} from "@src/season/seasonCompetitionCore";

const LEADERBOARD_LIMIT = 100;

function normalizePoints(row) {
  const r = row || {};
  const fgc = Number(r.fgcPoints ?? r?.families?.fgc?.points ?? 0) || 0;
  const tp = Number(r.tpPoints ?? r?.families?.tp?.points ?? 0) || 0;
  const ts =
    Number(
      r.tsPoints ??
        r.standardPoints ??
        r?.families?.ts?.points ??
        r?.families?.standard?.points ??
        0
    ) || 0;
  return Number(r.pointsTotal ?? fgc + tp + ts) || 0;
}

function isActiveMembership(data = {}) {
  return (
    (typeof data.status === "string" && data.status.toLowerCase() === "active") ||
    data.active === true ||
    data.status === undefined
  );
}

function computeRank(memberUids, pointsByUid, uid) {
  const pk = String(uid || "").trim();
  if (!pk || !memberUids.length) return null;

  const sorted = [...memberUids].sort((a, b) => {
    const diff = (pointsByUid.get(b) || 0) - (pointsByUid.get(a) || 0);
    if (diff !== 0) return diff;
    return String(a).localeCompare(String(b));
  });

  const index = sorted.indexOf(pk);
  return index >= 0 ? index + 1 : null;
}

function mergeLeaderboardRows(rowsByKey, readKeys) {
  const merged = new Map();
  for (const key of readKeys) {
    for (const row of rowsByKey[key] || []) {
      const id = String(row.uid || row.id || "").trim();
      if (!id) continue;
      const pts = normalizePoints(row);
      const prev = merged.get(id);
      if (!prev || pts >= normalizePoints(prev)) {
        merged.set(id, { ...row, uid: id, id });
      }
    }
  }
  return Array.from(merged.values());
}

/**
 * Points + rang groupe/compétition pour l'accueil.
 * Rang = position parmi les membres actifs (Nova incluse).
 */
export default function useGroupLeaderboardSummary({
  groupId,
  competitionKey,
  seasonId,
  sport,
  uid,
  enabled = true,
}) {
  const leaderboardKey = String(competitionKey || seasonId || "").trim();
  const sportKeyMatches = !sport || competitionKeyMatchesSport(leaderboardKey, sport);
  const readKeys = useMemo(
    () => resolveLeaderboardReadKeys(leaderboardKey),
    [leaderboardKey]
  );

  const [rowsByKey, setRowsByKey] = useState({});
  const [memberUids, setMemberUids] = useState([]);
  const [myPointsDirect, setMyPointsDirect] = useState(0);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [membershipsReady, setMembershipsReady] = useState(false);

  const canRun = enabled && !!groupId && !!leaderboardKey && !!uid && sportKeyMatches;

  useEffect(() => {
    let alive = true;

    if (!canRun) {
      setRowsByKey({});
      setMemberUids([]);
      setMyPointsDirect(0);
      setLoadingLeaderboard(false);
      setMembershipsReady(false);
      return () => {
        alive = false;
      };
    }

    setRowsByKey({});
    setMemberUids([]);
    setMyPointsDirect(0);
    setLoadingLeaderboard(true);
    setMembershipsReady(false);

    const gid = String(groupId);
    const pk = String(uid);
    const unsubs = [];

    for (const key of readKeys) {
      const membersRef = firestore()
        .collection(`groups/${gid}/leaderboards/${key}/members`)
        .orderBy("pointsTotal", "desc")
        .limit(LEADERBOARD_LIMIT);

      unsubs.push(
        membersRef.onSnapshot(
          (snap) => {
            if (!alive) return;
            setRowsByKey((prev) => ({
              ...prev,
              [key]: snap.docs.map((d) => ({
                id: d.id,
                uid: d.id,
                ...(d.data() || {}),
              })),
            }));
            setLoadingLeaderboard(false);
          },
          () => {
            if (!alive) return;
            setRowsByKey((prev) => ({ ...prev, [key]: [] }));
            setLoadingLeaderboard(false);
          }
        )
      );
    }

    const membershipsRef = firestore()
      .collection("group_memberships")
      .where("groupId", "==", gid);

    unsubs.push(
      membershipsRef.onSnapshot(
        (snap) => {
          if (!alive) return;
          const uids = snap.docs
            .map((d) => {
              const data = d.data() || {};
              if (!isActiveMembership(data)) return null;
              return String(data.uid || data.userId || data.participantId || "").trim() || null;
            })
            .filter(Boolean);
          setMemberUids(Array.from(new Set(uids)));
          setMembershipsReady(true);
        },
        () => {
          if (!alive) return;
          setMemberUids([]);
          setMembershipsReady(true);
        }
      )
    );

    const primaryKey = readKeys[0];
    if (primaryKey) {
      unsubs.push(
        firestore()
          .doc(`groups/${gid}/leaderboards/${primaryKey}/members/${pk}`)
          .onSnapshot(
            (snap) => {
              if (!alive) return;
              setMyPointsDirect(normalizePoints(snap.exists ? snap.data() : null));
            },
            () => {
              if (!alive) return;
              setMyPointsDirect(0);
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
  }, [canRun, groupId, leaderboardKey, uid, readKeys.join("|")]);

  return useMemo(() => {
    const leaderboardRows = mergeLeaderboardRows(rowsByKey, readKeys);
    const pointsByUid = new Map();

    for (const row of leaderboardRows) {
      const id = String(row.uid || row.id || "").trim();
      if (!id) continue;
      pointsByUid.set(id, normalizePoints(row));
    }

    const pk = String(uid || "").trim();
    const myPoints = pointsByUid.has(pk) ? pointsByUid.get(pk) : myPointsDirect;

    if (pk && !pointsByUid.has(pk)) {
      pointsByUid.set(pk, myPoints);
    }

    const effectiveMembers =
      memberUids.length > 0
        ? memberUids
        : pk
        ? [pk]
        : leaderboardRows.map((r) => String(r.uid || r.id || "")).filter(Boolean);

    const totalMembers = effectiveMembers.length;
    const myRank = computeRank(effectiveMembers, pointsByUid, pk);

    return {
      loading: canRun ? loadingLeaderboard || !membershipsReady : false,
      myPoints,
      myRank,
      totalMembers,
      hasGroup: canRun,
    };
  }, [
    rowsByKey,
    readKeys.join("|"),
    memberUids,
    myPointsDirect,
    uid,
    canRun,
    loadingLeaderboard,
    membershipsReady,
  ]);
}
