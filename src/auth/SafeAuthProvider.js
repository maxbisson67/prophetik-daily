// src/auth/SafeAuthProvider.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import RNFBAuth from "@react-native-firebase/auth";
import { webAuth } from "@src/lib/firebase";
import { signOut as webSignOut } from "firebase/auth";
//import { bridgeWebAuthOnce } from "./bridgeWebAuth";



const AuthCtx = createContext(null);

function mapUser(u) {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email ?? null,
    phoneNumber: u.phoneNumber ?? null,
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    _native: u,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [webBridged, setWebBridged] = useState(false);

  const settledRef = useRef(false);
  const safetyTimerRef = useRef(null);

  // 1) S'abonner à l'état d'auth natif (source de vérité)
  useEffect(() => {
    safetyTimerRef.current = setTimeout(() => {
      if (!settledRef.current) {
        settledRef.current = true;
        setAuthReady(true);
      }
    }, 2500);

    const unsub = RNFBAuth().onAuthStateChanged((u) => {
      setUser(mapUser(u));
      if (!settledRef.current) {
        settledRef.current = true;
        setAuthReady(true);
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    });

    return () => {
      try { unsub?.(); } catch {}
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    };
  }, []);

  // 2) Bridge native -> web après chaque login / changement d’uid
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setWebBridged(false);

        // Si aucun user natif → on s'assure que le web SDK est déconnecté
        if (!user?.uid) {
          try { await webSignOut(webAuth); } catch {}
          if (!cancelled) setWebBridged(false);
          return;
        }

        // Génère un custom token côté serveur (cloud function) ou
        // récupère l'ID token RNFB + signInWithCustomToken côté web (bridgeWebAuthOnce)
        //const ok = await bridgeWebAuthOnce();
        //if (!cancelled) setWebBridged(!!ok);
      } catch (e) {
        console.log(e?.message || String(e));
      }
    }

    if (authReady) run();
    return () => { cancelled = true; };
  }, [authReady, user?.uid]);

  const value = useMemo(() => {
    const initializing = !authReady;

    return {
      user,
      authReady,
      webBridged,      // utile pour bloquer des listeners Firestore tant que le bridge n'est pas prêt
      initializing,
      signOut: async () => {
        try { await RNFBAuth().signOut(); } catch (e) {
          console.log("[Auth] signOut native:", e?.message || String(e));
        }
        try { await webSignOut(webAuth); } catch {}
        setWebBridged(false);
      },
      waitForAuthReady: () =>
        authReady ? Promise.resolve() : new Promise((resolve) => {
          const iv = setInterval(() => { if (authReady) { clearInterval(iv); resolve(); } }, 50);
        }),
      waitForBridge: () =>
        webBridged ? Promise.resolve() : new Promise((resolve) => {
          const iv = setInterval(() => { if (webBridged) { clearInterval(iv); resolve(); } }, 50);
        }),
    };
  }, [user, authReady, webBridged]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function useAuthSafe() {
  try { return useAuth(); }
  catch {
    return {
      user: null,
      authReady: false,
      webBridged: false,
      initializing: true,
      signOut: async () => {},
      waitForAuthReady: async () => {},
      waitForBridge: async () => {},
    };
  }
}