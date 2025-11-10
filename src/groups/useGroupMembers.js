// src/groups/useGroupMembers.js
import { useEffect, useMemo, useState } from "react";
import { db } from "@src/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

/**
 * useGroupMembers(groupId)
 * Lit group_memberships pour un groupId donné et retourne
 * une liste prête pour l’UI (name, avatarUrl, email, credits, role…).
 */
export function useGroupMembers(groupId) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // On filtre par groupId et on trie par name (index composite possible)
    const qRef = query(
      collection(db, "group_memberships"),
      where("groupId", "==", groupId)
    );

    const un = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          // compat: certains projets stockent "uid" ou "userId"
          const uid = data.uid || data.userId || data.participantId || null;

          // actif si status=active, ou active=true, ou absence de champ
          const isActive =
            (typeof data.status === "string" && data.status.toLowerCase() === "active") ||
            data.active === true ||
            data.status === undefined;

          return {
            id: d.id,
            groupId: data.groupId,
            uid,
            name: data.displayName || "Invité",
            avatarUrl: data.avatarUrl || null,
            role: data.role || "member",
            isActive,
          };
        });

        setMembers(rows.filter((m) => m.isActive));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      try { un(); } catch {}
    };
  }, [groupId]);

  const owner = useMemo(
    () => members.find((m) => m.role === "owner") || null,
    [members]
  );

  const admins = useMemo(
    () => members.filter((m) => m.role === "admin"),
    [members]
  );

  const regulars = useMemo(
    () => members.filter((m) => !["owner", "admin"].includes(m.role)),
    [members]
  );

  const refresh = () => {}; // realtime

  return { members, owner, admins, regulars, loading, error, refresh };
}

export default useGroupMembers;