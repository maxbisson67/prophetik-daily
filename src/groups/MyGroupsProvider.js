import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useAppVisibilitySafe } from "@src/providers/AppVisibilityProvider";
import { listenRNFB } from "@src/dev/fsListen";
import { snapshotExists } from "@src/lib/safeSnapshot";
import { isActiveGroup, isGroupOwner } from "@src/groups/groupOwnership";
import {
  isParticipatingMember,
  isMembershipEligibleForParticipationChange,
  PARTICIPATION,
  resolveParticipation,
} from "@src/groups/participationUtils";

const MyGroupsContext = createContext(null);

function isMembershipListed(m) {
  return isMembershipEligibleForParticipationChange(m);
}

export function normalizeGroupMeta(gid, data = {}) {
  return {
    ...data,
    id: gid,
    name: data.name || data.title || gid,
    avatarUrl: data.avatarUrl || null,
    favoriteTeam: data.favoriteTeam || null,
    ownerId: data.ownerId || null,
    createdBy: data.createdBy || null,
    status: data.status || null,
    sport: String(data.sport || data.league || "NHL").toUpperCase(),
    tpBonus: Number(data.tpBonus ?? 0),
    autopilotEnabled: data.autopilotEnabled !== false,
  };
}

export function MyGroupsProvider({ children, enabled = true }) {
  const { user, authReady } = useAuth();
  const { isActive: appActive } = useAppVisibilitySafe();

  const [groupIds, setGroupIds] = useState([]);
  const [groupsMeta, setGroupsMeta] = useState({});
  const [membershipsByGroupId, setMembershipsByGroupId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const groupMetaUnsubs = useRef(new Map());
  const membershipUnsubs = useRef([]);

  const shouldListen = enabled && appActive && authReady && !!user?.uid;

  useEffect(() => {
    membershipUnsubs.current.forEach((un) => {
      try {
        un?.();
      } catch {}
    });
    membershipUnsubs.current = [];

    for (const [, un] of groupMetaUnsubs.current) {
      try {
        un?.();
      } catch {}
    }
    groupMetaUnsubs.current.clear();

    if (!shouldListen) {
      setMembershipsByGroupId({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const uid = user.uid;
    const qByUid = firestore().collection("group_memberships").where("uid", "==", uid);
    const qByUserId = firestore().collection("group_memberships").where("userId", "==", uid);
    const qByPid = firestore()
      .collection("group_memberships")
      .where("participantId", "==", uid);
    const qOwnerCreated = firestore().collection("groups").where("createdBy", "==", uid);
    const qOwnerOwnerId = firestore().collection("groups").where("ownerId", "==", uid);

    let rowsByUid = [];
    let rowsByUserId = [];
    let rowsByPid = [];
    let rowsOwnerCreated = [];
    let rowsOwnerOwnerId = [];

    const recompute = () => {
      const memberships = [...rowsByUid, ...rowsByUserId, ...rowsByPid].filter(isMembershipListed);
      const byGroupId = {};

      memberships.forEach((m) => {
        const gid = String(m.groupId || m.id?.split("_")[0] || "").trim();
        if (!gid) return;
        byGroupId[gid] = m;
      });

      setMembershipsByGroupId(byGroupId);

      const gidsFromMemberships = memberships.map((m) => m.groupId).filter(Boolean);
      const gidsFromOwner = [...rowsOwnerCreated, ...rowsOwnerOwnerId]
        .filter(isActiveGroup)
        .map((g) => g.id)
        .filter(Boolean);
      const unionSorted = Array.from(new Set([...gidsFromMemberships, ...gidsFromOwner])).sort();
      setGroupIds(unionSorted);
      setLoading(false);
    };

    const opts = { screen: "MyGroupsProvider" };

    membershipUnsubs.current = [
      listenRNFB(
        qByUid,
        (snap) => {
          rowsByUid = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
          recompute();
        },
        "group_memberships:uid",
        (e) => {
          setError(e);
          setLoading(false);
        },
        opts
      ),
      listenRNFB(
        qByUserId,
        (snap) => {
          rowsByUserId = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
          recompute();
        },
        "group_memberships:userId",
        (e) => {
          setError(e);
          setLoading(false);
        },
        opts
      ),
      listenRNFB(
        qByPid,
        (snap) => {
          rowsByPid = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
          recompute();
        },
        "group_memberships:participantId",
        (e) => {
          setError(e);
          setLoading(false);
        },
        opts
      ),
      listenRNFB(
        qOwnerCreated,
        (snap) => {
          rowsOwnerCreated = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
          recompute();
        },
        "groups:createdBy",
        (e) => {
          setError(e);
          setLoading(false);
        },
        opts
      ),
      listenRNFB(
        qOwnerOwnerId,
        (snap) => {
          rowsOwnerOwnerId = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }));
          recompute();
        },
        "groups:ownerId",
        (e) => {
          setError(e);
          setLoading(false);
        },
        opts
      ),
    ];

    return () => {
      membershipUnsubs.current.forEach((un) => {
        try {
          un?.();
        } catch {}
      });
      membershipUnsubs.current = [];
    };
  }, [shouldListen, user?.uid]);

  useEffect(() => {
    if (!shouldListen) return;

    for (const [gid, un] of groupMetaUnsubs.current) {
      if (!groupIds.includes(gid)) {
        try {
          un?.();
        } catch {}
        groupMetaUnsubs.current.delete(gid);
      }
    }

    groupIds.forEach((gid) => {
      if (groupMetaUnsubs.current.has(gid)) return;

      const ref = firestore().collection("groups").doc(gid);
      const un = listenRNFB(
        ref,
        (snap) => {
          if (!snapshotExists(snap)) {
            setGroupsMeta((prev) => {
              const next = { ...prev };
              delete next[gid];
              return next;
            });
            return;
          }

          const data = snap.data?.() || {};
          setGroupsMeta((prev) => ({
            ...prev,
            [gid]: normalizeGroupMeta(gid, data),
          }));
        },
        `groups:meta:${gid}`,
        (e) => setError(e),
        { screen: "MyGroupsProvider" }
      );

      groupMetaUnsubs.current.set(gid, un);
    });
  }, [shouldListen, groupIds.join("|")]);

  const readableGroupIds = useMemo(
    () =>
      groupIds.filter((gid) => {
        const g = groupsMeta[gid];
        return g && isActiveGroup(g);
      }),
    [groupIds, groupsMeta]
  );

  const userGroups = useMemo(
    () =>
      readableGroupIds.map((gid) => {
        const g = groupsMeta[gid] || {};
        const membership = membershipsByGroupId[gid];
        const owner = isGroupOwner(g, user?.uid);
        const participation = membership
          ? resolveParticipation(membership)
          : owner
            ? PARTICIPATION.ADMIN_ONLY
            : null;
        const canParticipateInChallenges = membership
          ? isParticipatingMember(membership)
          : false;

        return {
          ...g,
          id: gid,
          name: g.name || gid,
          avatarUrl: g.avatarUrl || null,
          sport: g.sport || "NHL",
          participation,
          hasMembershipDoc: Boolean(membership),
          canParticipateInChallenges,
        };
      }),
    [readableGroupIds, groupsMeta, membershipsByGroupId, user?.uid]
  );

  const value = useMemo(
    () => ({
      groupIds,
      readableGroupIds,
      groupsMeta,
      userGroups,
      loading,
      error,
    }),
    [groupIds, readableGroupIds, groupsMeta, userGroups, loading, error]
  );

  return <MyGroupsContext.Provider value={value}>{children}</MyGroupsContext.Provider>;
}

export function useMyGroups() {
  const ctx = useContext(MyGroupsContext);
  if (!ctx) {
    throw new Error("useMyGroups must be used within <MyGroupsProvider>");
  }
  return ctx;
}

export function useMyGroupsSafe() {
  try {
    return useMyGroups();
  } catch {
    return {
      groupIds: [],
      readableGroupIds: [],
      groupsMeta: {},
      userGroups: [],
      loading: false,
      error: null,
    };
  }
}
