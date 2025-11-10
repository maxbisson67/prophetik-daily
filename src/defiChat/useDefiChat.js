// src/defiChat/useDefiChat.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '@src/lib/firebase';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, setDoc
} from 'firebase/firestore';
import { useAuth } from '@src/auth/SafeAuthProvider';

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/**
 * useDefiChat(defiId, pageSizeOrOpts?)
 *
 * - Simple: useDefiChat(defiId, 50)
 * - Complet (Option A / CG): useDefiChat(defiId, { pageSize: 50, groupId, namesMap, participantInfoMap })
 */
export function useDefiChat(defiId, pageSizeOrOpts = 50) {
  const { user, profile } = useAuth();

  const isObj = typeof pageSizeOrOpts === 'object' && pageSizeOrOpts !== null;
  const pageSize = isObj ? (pageSizeOrOpts.pageSize ?? 50) : (pageSizeOrOpts ?? 50);
  const groupId  = isObj ? pageSizeOrOpts.groupId : undefined;

  // 🔵 Maps “vivantes” venant de profiles_public (injectées par l’appelant)
  const namesMap = isObj ? (pageSizeOrOpts.namesMap || {}) : {};
  const participantInfoMap = isObj ? (pageSizeOrOpts.participantInfoMap || {}) : {};

  // ⛏️ On conserve les messages bruts, et on dérive ensuite
  const [rawMessages, setRawMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  // ✅ prêt à envoyer ?
  const canSend = !!(defiId && groupId && user?.uid);

  // --- Lecture temps réel des messages (bruts) ---
  useEffect(() => {
    if (!defiId) return;
    const ref = collection(db, 'defis', String(defiId), 'messages');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(pageSize));
    const un = onSnapshot(q, (snap) => {
      setRawMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn('[useDefiChat] onSnapshot error:', err?.code || err?.message || err);
    });
    return () => un();
  }, [defiId, pageSize]);

  // --- Dérivation: override nom + avatar depuis profiles_public ---
  const messages = useMemo(() => {
    // On part du brut (desc), on ré-ordonne en asc si besoin dans l’UI
    return rawMessages.map((m) => {
      const uid = m.uid;
      const liveName =
        (uid && typeof namesMap[uid] === 'string' && namesMap[uid]) ||
        m.displayName ||
        uid;

      const info = uid ? participantInfoMap[uid] : undefined;
      const livePhoto = info?.photoURL || null;
      const version   = Number.isFinite(info?.version?.toMillis?.() ? info.version.toMillis() : info?.version)
        ? (info.version.toMillis ? info.version.toMillis() : info.version)
        : undefined;

      // Priorité à l’avatar “live” si dispo, sinon fallback sur le message
      const effectivePhoto = livePhoto || m.photoURL || null;
      const effectiveUri   = withCacheBust(effectivePhoto, version);

      return {
        ...m,
        displayName: liveName,
        photoURL: effectiveUri || effectivePhoto || null,
        _ver: version ?? 0,        // utile pour key
        _src: livePhoto ? 'live' : (m.photoURL ? 'msg' : 'none'),
      };
    });
  }, [rawMessages, namesMap, participantInfoMap]);

  // --- Envoi ---
  const send = useCallback(async (text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    if (!user?.uid) { console.warn('[useDefiChat.send] pas d’auth'); return; }
    if (!groupId)   { console.warn('[useDefiChat.send] groupId manquant'); return; }
    if (!defiId)    { console.warn('[useDefiChat.send] defiId manquant'); return; }

    const ref = collection(db, 'defis', String(defiId), 'messages');
    setBusy(true);
    try {
      // Même si on stocke un displayName/photoURL “au fil de l’eau”,
      // l’UI les override avec les valeurs live → pas de blocage si ça change plus tard.
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
        createdAt: serverTimestamp(),  // requis par la règle
        groupId: String(groupId),      // requis par la règle CG
        defiId: String(defiId),        // recommandé
        displayName,
        photoURL,
      };

      console.log('[useDefiChat.send] payload=', payload);
      await addDoc(ref, payload);
    } catch (e) {
      console.warn('[useDefiChat.send] addDoc error:', e?.code || e?.message || e);
    } finally {
      setBusy(false);
    }
  }, [defiId, groupId, user?.uid, profile?.displayName, profile?.photoURL, user?.displayName, user?.photoURL, namesMap, participantInfoMap]);

  // --- Marquer comme lu ---
  const markRead = useCallback(async () => {
    if (!user?.uid || !defiId) return;
    const r = doc(db, 'defis', String(defiId), 'reads', user.uid);
    await setDoc(r, { lastSeenAt: serverTimestamp(), lastOpenAt: serverTimestamp() }, { merge: true });
  }, [defiId, user?.uid]);

  return { messages, send, busy, markRead, canSend };
}