import { useEffect, useState, useCallback, useRef } from "react";
import firestore from "@react-native-firebase/firestore";

function messageMillis(createdAt) {
  if (createdAt?.toMillis) return createdAt.toMillis();
  if (createdAt?.toDate) return createdAt.toDate().getTime();
  return 0;
}

function countUnread(messages, uid, lastSeenAt) {
  if (!uid) return 0;
  const seenMs = lastSeenAt?.toMillis?.() ?? null;

  return (messages || []).filter((m) => {
    if (String(m?.uid || "") === String(uid)) return false;
    const ms = messageMillis(m?.createdAt);
    if (seenMs == null) return true;
    if (!ms) return true;
    return ms > seenMs;
  }).length;
}

/**
 * Compte les messages non lus du chat de groupe (hors messages de l'utilisateur).
 * Comptage client via snapshots — évite les requêtes composites fragiles.
 */
export function useGroupUnreadCount(groupId, uid) {
  const [count, setCount] = useState(0);
  const lastSeenRef = useRef(null);
  const messagesRef = useRef([]);

  const recompute = useCallback(() => {
    if (!groupId || !uid) {
      setCount(0);
      return;
    }
    setCount(countUnread(messagesRef.current, uid, lastSeenRef.current));
  }, [groupId, uid]);

  useEffect(() => {
    if (!groupId || !uid) {
      setCount(0);
      return;
    }

    lastSeenRef.current = null;
    messagesRef.current = [];

    const readRef = firestore().doc(`groups/${String(groupId)}/reads/${String(uid)}`);
    const unsubRead = readRef.onSnapshot(
      (snap) => {
        lastSeenRef.current = snap.exists ? snap.data()?.lastSeenAt ?? null : null;
        recompute();
      },
      (err) => {
        console.warn("[useGroupUnreadCount] read snapshot error:", err?.code || err?.message || err);
        lastSeenRef.current = null;
        recompute();
      }
    );

    const msgRef = firestore()
      .collection(`groups/${String(groupId)}/messages`)
      .orderBy("createdAt", "desc")
      .limit(50);

    const unsubMsg = msgRef.onSnapshot(
      (snap) => {
        messagesRef.current = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        recompute();
      },
      (err) => {
        console.warn("[useGroupUnreadCount] messages snapshot error:", err?.code || err?.message || err);
        messagesRef.current = [];
        recompute();
      }
    );

    return () => {
      try {
        unsubRead();
        unsubMsg();
      } catch {}
    };
  }, [groupId, uid, recompute]);

  return count;
}

/**
 * Total non-lus sur plusieurs groupes (pour badge global).
 */
export function useGroupsUnreadTotal(groupIds, uid) {
  const ids = Array.isArray(groupIds) ? groupIds.filter(Boolean).map(String) : [];
  const [total, setTotal] = useState(0);
  const countsRef = useRef({});

  useEffect(() => {
    if (!uid || !ids.length) {
      setTotal(0);
      countsRef.current = {};
      return;
    }

    const unsubs = ids.map((groupId) => {
      let lastSeenAt = null;
      let messages = [];

      const sync = () => {
        countsRef.current[groupId] = countUnread(messages, uid, lastSeenAt);
        setTotal(Object.values(countsRef.current).reduce((sum, n) => sum + (Number(n) || 0), 0));
      };

      const readRef = firestore().doc(`groups/${groupId}/reads/${String(uid)}`);
      const unsubRead = readRef.onSnapshot((snap) => {
        lastSeenAt = snap.exists ? snap.data()?.lastSeenAt ?? null : null;
        sync();
      });

      const msgRef = firestore()
        .collection(`groups/${groupId}/messages`)
        .orderBy("createdAt", "desc")
        .limit(50);

      const unsubMsg = msgRef.onSnapshot((snap) => {
        messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        sync();
      });

      return () => {
        delete countsRef.current[groupId];
        try {
          unsubRead();
          unsubMsg();
        } catch {}
      };
    });

    return () => {
      for (const off of unsubs) {
        try {
          off();
        } catch {}
      }
      countsRef.current = {};
    };
  }, [uid, ids.join("|")]);

  return total;
}
