// src/auth/AuthProvider.js
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

import { db } from "@src/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

import {
  registerCurrentFcmToken,
  startFcmTokenRefreshListener,
  stopFcmTokenRefreshListener,
} from "@src/lib/push/registerFcmToken";


const AuthCtx = createContext(undefined);
let __lastRegisteredUid = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const tokenListenerUidRef = useRef(null);

  const [participant, setParticipant] = useState(null);
  const [participantReady, setParticipantReady] = useState(false);

  // 1) Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);

      const uid = u?.uid || null;
      if (__lastRegisteredUid && __lastRegisteredUid !== uid) {
        __lastRegisteredUid = null;
      }
    });
    return unsubscribe;
  }, []);



  // 3) Push token setup (ton code, sans le useEffect imbriqué)
  useEffect(() => {
    const uid = user?.uid || null;

    if (!uid) {
      if (tokenListenerUidRef.current) {
        stopFcmTokenRefreshListener();
        tokenListenerUidRef.current = null;
      }
      return;
    }

    if (__lastRegisteredUid === uid) return;
    __lastRegisteredUid = uid;

    (async () => {
      try {
        await registerCurrentFcmToken(uid);
        stopFcmTokenRefreshListener();
        startFcmTokenRefreshListener(uid);
        tokenListenerUidRef.current = uid;
      } catch (err) {
        console.log("Push setup failed:", err?.message || String(err));
      }
    })();
  }, [user?.uid]);

  // 4) Participant doc
  useEffect(() => {
    setParticipant(null);
    setParticipantReady(false);

    const uid = user?.uid;
    if (!uid) {
      setParticipantReady(true);
      return;
    }

    const ref = doc(db, "participants", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setParticipant(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setParticipantReady(true);
      },
      (err) => {
        console.log("participants onSnapshot error:", err?.message || err);
        setParticipant(null);
        setParticipantReady(true);
      }
    );

    return () => {
      try { unsub(); } catch {}
    };
  }, [user?.uid]);

  const profile = {
    displayName: participant?.displayName ?? user?.displayName ?? null,
    photoURL: participant?.photoURL ?? user?.photoURL ?? null,
    email: participant?.email ?? user?.email ?? null,
  };

  const fullyReady = ready && participantReady;

  return (
    <AuthCtx.Provider
      value={{
        user,
        participant,
        profile,
        ready: fullyReady,
        booting: !ready,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}