// src/home/hooks/useEligibleChallengesCount.js
import { useEffect, useMemo, useRef, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { listenRNFB } from "@src/dev/fsListen";

function tsToMillis(v) {
  const d = v?.toDate?.() ? v.toDate() : v ? new Date(v) : null;
  return d ? d.getTime() : 0;
}

function safeDocs(snap) {
  return Array.isArray(snap?.docs) ? snap.docs : [];
}

function isMembershipActive(m) {
  const st = String(m?.status || "").toLowerCase();
  if (st) return ["open", "active", "approved"].includes(st);
  return m?.active !== false;
}

function isActiveDefiStatus(status) {
  const k = String(status || "").toLowerCase();
  return k === "open" || k === "live";
}

function stableKey(arr) {
  return (Array.isArray(arr) ? arr : []).slice().sort().join("|");
}

/**
 * Badge = # défis actifs (open/live) accessibles au user
 * pour lesquels il n'a pas encore enregistré de picks.
 *
 * ✅ Sans collectionGroup()
 * ✅ Guard anti mismatch uid (retour d'écran / refresh)
 * ✅ Debug: listenRNFB => tag + path sur permission-denied
 */
export function useEligibleChallengesCount({ userUid }) {
  const [groupIds, setGroupIds] = useState([]);
  const [activeDefis, setActiveDefis] = useState([]);

  // Map<defiId, picksLen|null> (null = doc participation absent)
  const [picksLenByDefiId, setPicksLenByDefiId] = useState(new Map());

  const groupsUnsubsRef = useRef([]);
  const defisUnsubsRef = useRef(new Map()); // Map<gid, unsub>
  const partsUnsubsRef = useRef(new Map()); // Map<defiId, unsub>

  // Auth guard
  const authUid = auth().currentUser?.uid || null;
  const canRead = !!authUid && !!userUid && String(authUid) === String(userUid);

  /* =========================
     1) GROUP IDS
  ========================= */
  useEffect(() => {
    if (!userUid) {
      setGroupIds([]);
      return;
    }

    // cleanup old
    groupsUnsubsRef.current.forEach((u) => {
      try { u?.(); } catch {}
    });
    groupsUnsubsRef.current = [];

    let rowsByUid = [];
    let rowsByPid = [];
    let rowsOwner = [];
    let rowsCreated = [];

    const recompute = () => {
      const memberships = [...rowsByUid, ...rowsByPid];

      const gidsFromMemberships = memberships
        .filter(isMembershipActive)
        .map((m) => String(m.groupId || "").trim())
        .filter(Boolean);

      const gidsFromOwner = rowsOwner
        .map((g) => String(g?.id || "").trim())
        .filter(Boolean);

      const gidsFromCreated = rowsCreated
        .map((g) => String(g?.id || "").trim())
        .filter(Boolean);

      setGroupIds(
        Array.from(new Set([...gidsFromMemberships, ...gidsFromOwner, ...gidsFromCreated]))
      );
    };

    const q1 = firestore().collection("group_memberships").where("uid", "==", userUid);
    const q2 = firestore().collection("group_memberships").where("participantId", "==", userUid);
    const q3 = firestore().collection("groups").where("ownerId", "==", userUid);
    const q4 = firestore().collection("groups").where("createdBy", "==", userUid);

    const un1 = listenRNFB(
      q1,
      (snap) => {
        rowsByUid = safeDocs(snap).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      `eligible:memberships:uid:${userUid}`,
      () => {
        rowsByUid = [];
        recompute();
      }
    );

    const un2 = listenRNFB(
      q2,
      (snap) => {
        rowsByPid = safeDocs(snap).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      `eligible:memberships:participantId:${userUid}`,
      () => {
        rowsByPid = [];
        recompute();
      }
    );

    const un3 = listenRNFB(
      q3,
      (snap) => {
        rowsOwner = safeDocs(snap).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      `eligible:groups:ownerId:${userUid}`,
      () => {
        rowsOwner = [];
        recompute();
      }
    );

    const un4 = listenRNFB(
      q4,
      (snap) => {
        rowsCreated = safeDocs(snap).map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      `eligible:groups:createdBy:${userUid}`,
      () => {
        rowsCreated = [];
        recompute();
      }
    );

    groupsUnsubsRef.current = [un1, un2, un3, un4];

    return () => {
      groupsUnsubsRef.current.forEach((u) => {
        try { u?.(); } catch {}
      });
      groupsUnsubsRef.current = [];
    };
  }, [userUid]);

  /* =========================
     2) ACTIVE DEFIS per group
  ========================= */
  const groupKey = useMemo(() => stableKey(groupIds), [groupIds]);

  useEffect(() => {
    // remove listeners for removed groups
    for (const [gid, un] of defisUnsubsRef.current.entries()) {
      if (!groupIds.includes(gid)) {
        try { un?.(); } catch {}
        defisUnsubsRef.current.delete(gid);
        setActiveDefis((prev) =>
          (prev || []).filter((d) => String(d.groupId) !== String(gid))
        );
      }
    }

    if (!groupIds.length) {
      setActiveDefis([]);
      return;
    }

    for (const gid of groupIds) {
      if (defisUnsubsRef.current.has(gid)) continue;

      const q = firestore().collection("defis").where("groupId", "==", gid);

      const un = listenRNFB(
        q,
        (snap) => {
          const rows = safeDocs(snap).map((d) => ({ id: d.id, ...d.data() }));
          const actives = rows.filter((r) => isActiveDefiStatus(r.status));

          setActiveDefis((prev) => {
            const without = (prev || []).filter((x) => String(x.groupId) !== String(gid));
            return [...without, ...actives];
          });
        },
        `eligible:defis:byGroup:${gid}`,
        () => {
          // si erreur: retire ce groupe pour éviter badge stuck
          setActiveDefis((prev) =>
            (prev || []).filter((x) => String(x.groupId) !== String(gid))
          );
        }
      );

      defisUnsubsRef.current.set(gid, un);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  /* =========================
     3) PARTICIPATIONS
  ========================= */
  const activeDefiIds = useMemo(() => {
    const ids = (activeDefis || []).map((d) => String(d?.id || "")).filter(Boolean);
    return Array.from(new Set(ids));
  }, [activeDefis]);

  const activeDefiIdsKey = useMemo(() => stableKey(activeDefiIds), [activeDefiIds]);

  useEffect(() => {
    // cleanup removed defis
    for (const [defiId, un] of partsUnsubsRef.current.entries()) {
      if (!activeDefiIds.includes(defiId)) {
        try { un?.(); } catch {}
        partsUnsubsRef.current.delete(defiId);
        setPicksLenByDefiId((prev) => {
          const next = new Map(prev);
          next.delete(defiId);
          return next;
        });
      }
    }

    // ✅ Guard principal (évite mismatch au retour d'écran)
    if (!canRead || !activeDefiIds.length) {
      for (const [, un] of partsUnsubsRef.current.entries()) {
        try { un?.(); } catch {}
      }
      partsUnsubsRef.current.clear();
      setPicksLenByDefiId(new Map());
      return;
    }

    // add listeners
    for (const defiId of activeDefiIds) {
      if (partsUnsubsRef.current.has(defiId)) continue;

      const path = `defis/${defiId}/participations/${userUid}`;
      const ref = firestore().doc(path);

      const un = listenRNFB(
        ref,
        (snap) => {
          const exists = !!snap?.exists;
          const data = exists ? snap.data() || {} : {};
          const picks = Array.isArray(data.picks) ? data.picks : [];
          const len = exists ? picks.length : null; // null = doc absent

          setPicksLenByDefiId((prev) => {
            const next = new Map(prev);
            next.set(defiId, len);
            return next;
          });
        },
        `eligible:participation:${defiId}:${userUid}`,
        (err) => {
          // ✅ Ici: même si c'est denied, fsListen l'a déjà loggué (tag+path)
          // On garde un fallback "pas de picks" pour ne pas bloquer le badge.
          setPicksLenByDefiId((prev) => {
            const next = new Map(prev);
            next.set(defiId, null);
            return next;
          });
        }
      );

      partsUnsubsRef.current.set(defiId, un);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, userUid, activeDefiIdsKey]);

  /* =========================
     4) COMPUTE BADGE COUNT
  ========================= */
  const eligibleCount = useMemo(() => {
    const now = Date.now();

    return (activeDefis || [])
      .filter((d) => {
        const defiId = String(d?.id || "");
        if (!defiId) return false;

        const dl = tsToMillis(d.signupDeadline);
        if (dl && dl < now) return false;

        const picksLen = picksLenByDefiId.get(defiId);
        return picksLen == null || picksLen === 0;
      })
      .length;
  }, [activeDefis, picksLenByDefiId]);

  return eligibleCount;
}