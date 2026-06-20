import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

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

/**
 * Points + rang groupe/saison pour l'accueil.
 * Rang = position parmi les membres actifs (0 pt inclus).
 */
export default function useGroupLeaderboardSummary({ groupId, seasonId, uid }) {
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [memberUids, setMemberUids] = useState([]);
  const [myPointsDirect, setMyPointsDirect] = useState(0);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [membershipsReady, setMembershipsReady] = useState(false);

  const canRun = !!groupId && !!seasonId && !!uid;

  useEffect(() => {
    if (!canRun) {
      setLeaderboardRows([]);
      setMemberUids([]);
      setMyPointsDirect(0);
      setLoadingLeaderboard(false);
      setMembershipsReady(false);
      return;
    }

    setLoadingLeaderboard(true);
    setMembershipsReady(false);

    const gid = String(groupId);
    const sid = String(seasonId);
    const pk = String(uid);

    const membersRef = firestore()
      .collection(`groups/${gid}/leaderboards/${sid}/members`)
      .orderBy("pointsTotal", "desc")
      .limit(LEADERBOARD_LIMIT);

    const membershipsRef = firestore()
      .collection("group_memberships")
      .where("groupId", "==", gid);

    const meRef = firestore()
      .doc(`groups/${gid}/leaderboards/${sid}/members/${pk}`);

    const unMembers = membersRef.onSnapshot(
      (snap) => {
        setLeaderboardRows(
          snap.docs.map((d) => ({
            id: d.id,
            uid: d.id,
            ...(d.data() || {}),
          }))
        );
        setLoadingLeaderboard(false);
      },
      () => {
        setLeaderboardRows([]);
        setLoadingLeaderboard(false);
      }
    );

    const unMemberships = membershipsRef.onSnapshot(
      (snap) => {
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
        setMemberUids([]);
        setMembershipsReady(true);
      }
    );

    const unMe = meRef.onSnapshot(
      (snap) => {
        setMyPointsDirect(normalizePoints(snap.exists ? snap.data() : null));
      },
      () => setMyPointsDirect(0)
    );

    return () => {
      try {
        unMembers?.();
      } catch {}
      try {
        unMemberships?.();
      } catch {}
      try {
        unMe?.();
      } catch {}
    };
  }, [canRun, groupId, seasonId, uid]);

  return useMemo(() => {
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
    leaderboardRows,
    memberUids,
    myPointsDirect,
    uid,
    canRun,
    loadingLeaderboard,
    membershipsReady,
  ]);
}
