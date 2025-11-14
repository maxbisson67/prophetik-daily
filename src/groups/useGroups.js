// src/groups/useGroups.js
import { useEffect, useMemo, useRef, useState } from "react";
import firestore from "@react-native-firebase/firestore";

/**
 * useGroups(uid)
 * - Lit uniquement group_memberships (uid / participantId)
 * - Pour chaque groupId, lit le doc /groups/{groupId}
 * - Aucune query directe sur /groups
 */
export function useGroups(uid) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(!!uid);
  const [error, setError] = useState(null);

  // Map<groupId, unsubscribe>
  const groupUnsubsRef = useRef(new Map());

  useEffect(() => {
    // cleanup helper
    const cleanupAll = () => {
      for (const [, un] of groupUnsubsRef.current) {
        try { un(); } catch {}
      }
      groupUnsubsRef.current.clear();
    };

    if (!uid) {
      cleanupAll();
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Compat: certains projets stockent uid dans "uid" OU "participantId"
    const qByUid = firestore()
      .collection("group_memberships")
      .where("uid", "==", String(uid));

    const qByPid = firestore()
      .collection("group_memberships")
      .where("participantId", "==", String(uid));

    let rowsByUid = [];
    let rowsByPid = [];

    const recomputeFromMemberships = () => {
      // membre actif si status=active, active=true, ou champ absent
      const isActive = (m) =>
        (typeof m?.status === "string" &&
          m.status.toLowerCase() === "active") ||
        m?.active === true ||
        m?.status === undefined;

      const ms = [...rowsByUid, ...rowsByPid].filter(isActive);

      // groupId -> role effectif (owner prioritaire)
      const byGroup = new Map();
      for (const m of ms) {
        if (!m?.groupId) continue;
        const prevRole = byGroup.get(m.groupId);
        const role = (m.role === "owner" || prevRole === "owner") ? "owner" : (m.role || "member");
        byGroup.set(m.groupId, role);
      }

      // détacher les listeners obsolètes
      for (const [gid, un] of groupUnsubsRef.current) {
        if (!byGroup.has(gid)) {
          try { un(); } catch {}
          groupUnsubsRef.current.delete(gid);
        }
      }

      // attacher les listeners manquants
      for (const [gid, role] of byGroup.entries()) {
        if (groupUnsubsRef.current.has(gid)) continue;

        const gref = firestore().doc(`groups/${gid}`);
        const un = gref.onSnapshot(
          (gSnap) => {
            if (!gSnap.exists) {
              setGroups((prev) => prev.filter((g) => g.id !== gid));
              return;
            }
            const data = { id: gSnap.id, ...gSnap.data() };

            setGroups((prev) => {
              const map = new Map(prev.map((g) => [g.id, g]));
              const existing = map.get(gid) || {};
              // si existing.role = 'owner', on garde; sinon on met le role calculé
              const effRole = existing.role === "owner" ? "owner" : role;
              map.set(gid, { ...existing, ...data, role: effRole });
              return Array.from(map.values()).sort(sortByUpdatedAt);
            });
          },
          (err) => setError(err)
        );

        groupUnsubsRef.current.set(gid, un);
      }

      // aucun groupe actif → vider
      if (byGroup.size === 0) setGroups([]);

      setLoading(false);
    };

    const unByUid = qByUid.onSnapshot(
      (snap) => {
        rowsByUid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recomputeFromMemberships();
      },
      (err) => { setError(err); setLoading(false); }
    );

    const unByPid = qByPid.onSnapshot(
      (snap) => {
        rowsByPid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recomputeFromMemberships();
      },
      (err) => { setError(err); setLoading(false); }
    );

    return () => {
      try { unByUid(); } catch {}
      try { unByPid(); } catch {}
      cleanupAll();
    };
  }, [uid]);

  const groupsOwned = useMemo(
    () => groups.filter((g) => g.role === "owner" || g.ownerId === uid || g.createdBy === uid),
    [groups, uid]
  );

  const groupsMember = useMemo(
    () => groups.filter((g) => !(g.role === "owner" || g.ownerId === uid || g.createdBy === uid)),
    [groups, uid]
  );

  const refresh = () => {}; // realtime

  return { groups, groupsOwned, groupsMember, loading, error, refresh };
}

function sortByUpdatedAt(a, b) {
  // RNFB renvoie des Timestamp avec .seconds; on garde ta logique
  const as = a?.updatedAt?.seconds ?? a?.createdAt?.seconds ?? 0;
  const bs = b?.updatedAt?.seconds ?? b?.createdAt?.seconds ?? 0;
  return bs - as;
}

export default useGroups;