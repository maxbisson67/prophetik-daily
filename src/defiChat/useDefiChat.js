// src/defiChat/useDefiChat.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@src/auth/SafeAuthProvider';

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/**
 * useDefiChat(defiId, pageSizeOrOpts?)
 * - Simple : useDefiChat(defiId, 50)
 * - Complet : useDefiChat(defiId, { pageSize: 50, groupId, namesMap, participantInfoMap })
 */
export function useDefiChat(defiId, pageSizeOrOpts = 50) {
  const { user, profile } = useAuth();

  const isObj    = typeof pageSizeOrOpts === 'object' && pageSizeOrOpts !== null;
  const pageSize = isObj ? (pageSizeOrOpts.pageSize ?? 50) : (pageSizeOrOpts ?? 50);
  const groupId  = isObj ? pageSizeOrOpts.groupId : undefined;

  const namesMap = isObj ? (pageSizeOrOpts.namesMap || {}) : {};
  const participantInfoMap = isObj ? (pageSizeOrOpts.participantInfoMap || {}) : {};

  const [rawMessages, setRawMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const canSend = !!(defiId && groupId && user?.uid);

  // 🔄 Lecture live (desc, limitée)
  useEffect(() => {
    if (!defiId) return;
    const ref = firestore()
      .collection(`defis/${String(defiId)}/messages`)
      .orderBy('createdAt', 'desc')
      .limit(pageSize);

    const unsub = ref.onSnapshot(
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        setRawMessages(rows);
      },
      (err) => console.warn('[useDefiChat] snapshot error:', err?.code || err?.message || err)
    );
    return () => { try { unsub(); } catch {} };
  }, [defiId, pageSize]);

  // 🧠 Derive noms/avatars “live” (profiles_public)
  const messages = useMemo(() => {
    return rawMessages.map((m) => {
      const uid = m.uid;
      const liveName =
        (uid && typeof namesMap[uid] === 'string' && namesMap[uid]) ||
        m.displayName ||
        uid;

      const info = uid ? participantInfoMap[uid] : undefined;
      const livePhoto = info?.photoURL || null;
      const version =
        typeof info?.version === 'number'
          ? info.version
          : (info?.version?.toMillis?.() ? info.version.toMillis() : undefined);

      const effectivePhoto = livePhoto || m.photoURL || null;
      const effectiveUri   = withCacheBust(effectivePhoto, version);

      return {
        ...m,
        displayName: liveName,
        photoURL: effectiveUri || effectivePhoto || null,
        _ver: version ?? 0,
        _src: livePhoto ? 'live' : (m.photoURL ? 'msg' : 'none'),
      };
    });
  }, [rawMessages, namesMap, participantInfoMap]);

  // ✉️ Envoi
  const send = useCallback(async (text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    if (!user?.uid) { console.warn('[useDefiChat.send] no auth'); return; }
    if (!groupId)   { console.warn('[useDefiChat.send] groupId missing'); return; }
    if (!defiId)    { console.warn('[useDefiChat.send] defiId missing'); return; }

    setBusy(true);
    try {
      const displayName =
        namesMap[user.uid] ||
        profile?.displayName ||
        user.displayName ||
        user.email ||
        'Anonyme';

      const photoURL =
        participantInfoMap[user.uid]?.photoURL ||
        profile?.photoURL ||
        user.photoURL ||
        null;

      const payload = {
        uid: user.uid,
        text: clean,
        type: 'text',
        createdAt: firestore.FieldValue.serverTimestamp(), // ⬅️ RN Firebase
        groupId: String(groupId),                          // ⬅️ règles CG
        defiId: String(defiId),
        displayName,
        photoURL,
      };

      await firestore().collection(`defis/${String(defiId)}/messages`).add(payload);
    } catch (e) {
      console.warn('[useDefiChat.send] add error:', e?.code || e?.message || e);
    } finally {
      setBusy(false);
    }
  }, [defiId, groupId, user?.uid, profile?.displayName, profile?.photoURL, user?.displayName, user?.photoURL, namesMap, participantInfoMap]);

  // 👀 Marquer comme lu
  const markRead = useCallback(async () => {
    if (!user?.uid || !defiId) return;
    const r = firestore().doc(`defis/${String(defiId)}/reads/${user.uid}`);
    await r.set(
      {
        lastSeenAt: firestore.FieldValue.serverTimestamp(),
        lastOpenAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }, [defiId, user?.uid]);

  return { messages, send, busy, markRead, canSend };
}