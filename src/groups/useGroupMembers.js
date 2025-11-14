// src/groups/useGroupMembers.js
import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

/**
 * useGroupMembers(groupId)
 * Lit group_memberships pour un groupId donné et retourne
 * une liste prête pour l’UI (name, avatarUrl, role, etc.).
 */
export function useGroupMembers(groupId) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState(null);

  useEffect(() => {
    // reset à chaque changement de groupId
    setMembers([]);
    setError(null);

    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // RNFB: use firestore().collection(...).where(...)
    const qRef = firestore()
      .collection("group_memberships")
      .where("groupId", "==", String(groupId));

    const unsubscribe = qRef.onSnapshot(
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};

          // compat: uid vs userId vs participantId
          const uid =
            data.uid || data.userId || data.participantId || null;

          // actif si status=active, ou active=true, ou champ absent
          const isActive =
            (typeof data.status === "string" &&
              data.status.toLowerCase() === "active") ||
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
      try { unsubscribe(); } catch {}
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