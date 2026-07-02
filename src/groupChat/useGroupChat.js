import { useEffect, useState, useCallback, useMemo } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { sendGroupMessageService } from "@src/groupChat/sendGroupMessageService";

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes("?") ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/**
 * Chat par groupe — messages dans groups/{groupId}/messages
 */
export function useGroupChat(groupId, pageSizeOrOpts = 50) {
  const { user } = useAuth();

  const isObj = typeof pageSizeOrOpts === "object" && pageSizeOrOpts !== null;
  const pageSize = isObj ? (pageSizeOrOpts.pageSize ?? 50) : (pageSizeOrOpts ?? 50);
  const namesMap = isObj ? (pageSizeOrOpts.namesMap || {}) : {};
  const participantInfoMap = isObj ? (pageSizeOrOpts.participantInfoMap || {}) : {};

  const [rawMessages, setRawMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const canSend = !!(groupId && user?.uid);

  useEffect(() => {
    if (!groupId) {
      setRawMessages([]);
      return;
    }

    const ref = firestore()
      .collection(`groups/${String(groupId)}/messages`)
      .orderBy("createdAt", "desc")
      .limit(pageSize);

    const unsub = ref.onSnapshot(
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setRawMessages(rows);
      },
      (err) => console.warn("[useGroupChat] snapshot error:", err?.code || err?.message || err)
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [groupId, pageSize]);

  const messages = useMemo(() => {
    return rawMessages.map((m) => {
      const uid = m.uid;
      const liveName =
        (uid && typeof namesMap[uid] === "string" && namesMap[uid]) ||
        m.displayName ||
        uid;

      const info = uid ? participantInfoMap[uid] : undefined;
      const livePhoto = info?.photoURL || null;
      const version =
        typeof info?.version === "number"
          ? info.version
          : info?.version?.toMillis?.()
            ? info.version.toMillis()
            : undefined;

      const effectivePhoto = livePhoto || m.photoURL || null;
      const effectiveUri = withCacheBust(effectivePhoto, version);

      return {
        ...m,
        displayName: liveName,
        photoURL: effectiveUri || effectivePhoto || null,
        _ver: version ?? 0,
      };
    });
  }, [rawMessages, namesMap, participantInfoMap]);

  const send = useCallback(
    async (text) => {
      const clean = String(text || "").trim();
      if (!clean) return;
      if (!user?.uid) return;
      if (!groupId) return;

      setBusy(true);
      try {
        await sendGroupMessageService({ groupId: String(groupId), text: clean });
      } catch (e) {
        console.warn("[useGroupChat.send] error:", e?.key || e?.code || e?.message || e);
      } finally {
        setBusy(false);
      }
    },
    [groupId, user?.uid]
  );

  const markRead = useCallback(async () => {
    if (!user?.uid || !groupId) return;
    const r = firestore().doc(`groups/${String(groupId)}/reads/${user.uid}`);
    await r.set(
      {
        lastSeenAt: firestore.FieldValue.serverTimestamp(),
        lastOpenAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }, [groupId, user?.uid]);

  return { messages, send, busy, markRead, canSend };
}
