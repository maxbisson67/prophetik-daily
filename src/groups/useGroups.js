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
 *
 * Retourne en temps réel la liste des groupes liés à l'utilisateur via
 * - ses memberships actives (status:"active" OU active:true)
 * - les groupes qu'il possède (ownerId == uid OU createdBy == uid)
 *
 * Renvoie: { groups, groupsOwned, groupsMember, loading, error, refresh }
 */
export function useGroups(uid) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(!!uid);
  const [error, setError] = useState(null);

  // Listeners dynamiques sur chaque doc group
  const groupUnsubsRef = useRef(new Map()); // Map<groupId, Unsub>
  // Listeners pour les groupes possédés (ownerId/createdBy)
  const ownerUnsubsRef = useRef([]); // Unsub[]

  useEffect(() => {
    // Cleanup helper
    const cleanupAll = () => {
      for (const [, un] of groupUnsubsRef.current) un();
      groupUnsubsRef.current.clear();
      for (const un of ownerUnsubsRef.current) un();
      ownerUnsubsRef.current = [];
    };

    // Reset si pas d'utilisateur
    if (!uid) {
      cleanupAll();
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // 1) Groupes possédés par l'utilisateur (ownerId == uid OU createdBy == uid)
    const attachOwnedListener = (field) => {
      const qOwner = query(collection(db, "groups"), where(field, "==", uid));
      const unsub = onSnapshot(
        qOwner,
        (gSnap) => {
          const owned = gSnap.docs.map((d) => ({ id: d.id, ...d.data(), role: "owner" }));
          setGroups((prev) => {
            const map = new Map(prev.map((g) => [g.id, g]));
            for (const g of owned) {
              const existing = map.get(g.id) || {};
              map.set(g.id, { ...existing, ...g, role: "owner" }); // priorité à owner
            }
            return Array.from(map.values()).sort(sortByUpdatedAt);
          });
          setLoading(false); // on a déjà des données utiles
        },
        (err) => setError(err)
      );
      ownerUnsubsRef.current.push(unsub);
    };

    attachOwnedListener("ownerId");
    attachOwnedListener("createdBy");

    // 2) Memberships actives de l'utilisateur
    const qM = query(collection(db, "group_memberships"), where("uid", "==", uid));
    const unsubMemberships = onSnapshot(
      qM,
      (snap) => {
        const memberships = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          // compat: status:"active" OU active:true (ou pas de champ -> actif)
          .filter((m) => (m.status ? m.status === "active" : m.active === true || m.active === undefined));

        const currentIds = new Set(memberships.map((m) => m.groupId));

        // Stop les listeners obsolètes
        for (const [gid, un] of groupUnsubsRef.current) {
          if (!currentIds.has(gid)) {
            un();
            groupUnsubsRef.current.delete(gid);
          }
        }

        // Ajoute listeners manquants pour chaque groupe de membership
        for (const gid of currentIds) {
          if (groupUnsubsRef.current.has(gid)) continue;

          const gref = doc(db, "groups", gid);
          const un = onSnapshot(
            gref,
            (gSnap) => {
              if (!gSnap.exists()) {
                setGroups((prev) => prev.filter((g) => g.id !== gid));
                return;
              }
              const gData = { id: gSnap.id, ...gSnap.data() };
              const role = memberships.find((m) => m.groupId === gid)?.role ?? "member";

              setGroups((prev) => {
                const map = new Map(prev.map((x) => [x.id, x]));
                const existing = map.get(gid) || {};
                // Si déjà marqué owner via owned-listener, on garde owner
                const effRole = existing.role === "owner" ? "owner" : role;
                map.set(gid, { ...existing, ...gData, role: effRole });
                return Array.from(map.values()).sort(sortByUpdatedAt);
              });
            },
            (err) => setError(err)
          );

          groupUnsubsRef.current.set(gid, un);
        }

        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    // cleanup global
    return () => {
      unsubMemberships();
      for (const [, un] of groupUnsubsRef.current) un();
      groupUnsubsRef.current.clear();
      for (const un of ownerUnsubsRef.current) un();
      ownerUnsubsRef.current = [];
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

  const refresh = () => {
    // rien à faire: listeners temps réel. (placeholder pour compat)
  };

  return { groups, groupsOwned, groupsMember, loading, error, refresh };
}

function sortByUpdatedAt(a, b) {
  const as = a?.updatedAt?.seconds ?? a?.createdAt?.seconds ?? 0;
  const bs = b?.updatedAt?.seconds ?? b?.createdAt?.seconds ?? 0;
  return bs - as;
}

export default useGroups;