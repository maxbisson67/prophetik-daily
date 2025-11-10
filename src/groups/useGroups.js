// src/groups/useGroups.js
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@src/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
} from "firebase/firestore";

/**
 * useGroups(uid)
 * - Lit uniquement group_memberships (uid / participantId)
 * - Pour chaque groupId, lit le doc /groups/{groupId}
 * - AUCUNE query de collection sur /groups (évite 'list' dans les règles)
 */
export function useGroups(uid) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(!!uid);
  const [error, setError] = useState(null);

  // Listeners dynamiques par groupId
  const groupUnsubsRef = useRef(new Map()); // Map<groupId, () => void>

  useEffect(() => {
    // helper cleanup
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

    // on écoute 2 champs possibles (compat)
    const qByUid = query(collection(db, "group_memberships"), where("uid", "==", uid));
    const qByPid = query(collection(db, "group_memberships"), where("participantId", "==", uid));

    // état courant des memberships (fusion des deux listeners)
    let rowsByUid = [];
    let rowsByPid = [];

    const recomputeFromMemberships = () => {
      // filtre "actives"
      const active = (m) =>
        (m?.status ? String(m.status).toLowerCase() === "active" : (m?.active === true || m?.active === undefined));

      const ms = [...rowsByUid, ...rowsByPid].filter(active);

      // map groupId -> role effectif (owner prioritaire si une des entries dit owner)
      const byGroup = new Map();
      for (const m of ms) {
        if (!m?.groupId) continue;
        const prev = byGroup.get(m.groupId);
        const role = (m.role === "owner" || prev === "owner") ? "owner" : (m.role || "member");
        byGroup.set(m.groupId, role);
      }

      // détache les listeners obsolètes
      for (const [gid, un] of groupUnsubsRef.current) {
        if (!byGroup.has(gid)) {
          try { un(); } catch {}
          groupUnsubsRef.current.delete(gid);
        }
      }

      // attache les listeners manquants
      for (const [gid, role] of byGroup.entries()) {
        if (groupUnsubsRef.current.has(gid)) continue;

        const gref = doc(db, "groups", gid);
        const un = onSnapshot(
          gref,
          (gSnap) => {
            if (!gSnap.exists()) {
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

      // si aucun groupId actif, on vide
      if (byGroup.size === 0) {
        setGroups([]);
      }

      setLoading(false);
    };

    const unByUid = onSnapshot(
      qByUid,
      (snap) => { rowsByUid = snap.docs.map((d) => ({ id: d.id, ...d.data() })); recomputeFromMemberships(); },
      (err) => { setError(err); setLoading(false); }
    );

    const unByPid = onSnapshot(
      qByPid,
      (snap) => { rowsByPid = snap.docs.map((d) => ({ id: d.id, ...d.data() })); recomputeFromMemberships(); },
      (err) => { setError(err); setLoading(false); }
    );

    return () => {
      try { unByUid(); } catch {}
      try { unByPid(); } catch {}
      cleanupAll();
    };
  }, [uid, db]);

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
  const as = a?.updatedAt?.seconds ?? a?.createdAt?.seconds ?? 0;
  const bs = b?.updatedAt?.seconds ?? b?.createdAt?.seconds ?? 0;
  return bs - as;
}

export default useGroups;