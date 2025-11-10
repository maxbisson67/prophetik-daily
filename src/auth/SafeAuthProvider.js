// src/auth/SafeAuthProvider.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import RNFBAuth from "@react-native-firebase/auth";
import { webAuth } from "@src/lib/firebase";
import { signOut as webSignOut } from "firebase/auth";
import { bridgeWebAuthOnce } from "./bridgeWebAuth";

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

  // Subscribe to native auth
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

  // Bridge native -> web after any login / uid change
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Reset flag; we’ll re-enable it once bridged
        setWebBridged(false);

        // If native is out, keep web out too
        if (!user?.uid) {
          try { await webSignOut(webAuth); } catch {}
          if (!cancelled) setWebBridged(false);
          return;
        }

        const ok = await bridgeWebAuthOnce();
        if (!cancelled) setWebBridged(!!ok);
      } catch (e) {
        console.log("[Bridge] failed:", e?.message || String(e));
        if (!cancelled) setWebBridged(false);
      }
    }

    // Only start bridging once native auth is known
    if (authReady) run();

    return () => { cancelled = true; };
  }, [authReady, user?.uid]);

  const value = useMemo(() => {
    const initializing = !authReady;

    return {
      user,
      authReady,
      webBridged,            // 👈 expose this
      initializing,
      signOut: async () => {
        try { await RNFBAuth().signOut(); } catch (e) { console.log("[Auth] signOut native:", e?.message || String(e)); }
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