// src/auth/SafeAuthProvider.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import RNFBAuth from "@react-native-firebase/auth";
import { webAuth } from "@src/lib/firebase";
import { signOut as webSignOut } from "firebase/auth";
import Purchases from "react-native-purchases";
import { initPurchases } from "@src/lib/purchases/initPurchases";

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

  // ✅ RC state
  const [rcReady, setRcReady] = useState(false);
  const [rcAppUserId, setRcAppUserId] = useState(null);

  const settledRef = useRef(false);
  const safetyTimerRef = useRef(null);

  // 1) Auth natif
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
      try {
        unsub?.();
      } catch {}
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    };
  }, []);

  // 2) Bridge native -> web (tu l’as laissé en standby)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setWebBridged(false);

        if (!user?.uid) {
          try {
            await webSignOut(webAuth);
          } catch {}
          if (!cancelled) setWebBridged(false);
          return;
        }

        // const ok = await bridgeWebAuthOnce();
        // if (!cancelled) setWebBridged(!!ok);
      } catch (e) {
        console.log("[Auth bridge] error:", e?.message || String(e));
      }
    }

    if (authReady) run();
    return () => {
      cancelled = true;
    };
  }, [authReady, user?.uid]);

  // 3) RevenueCat: configure + logIn aligné sur Firebase UID
  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    (async () => {
      try {
        setRcReady(false);
        setRcAppUserId(null);

        // ✅ configure UNE fois (idempotent)
        initPurchases();

        // ✅ si user null, on garde RC logged-out (anon) et rcReady=false
        if (!user?.uid) {
          return;
        }

        // ✅ IMPORTANT: NE PAS faire logOut() ici
        // Sinon tu recrées des $RCAnonymousID et tu risques d’écrire au mauvais doc.
        const { customerInfo, created } = await Purchases.logIn(String(user.uid));
        // created = true si nouvel user RC

        const currentId = await Purchases.getAppUserID();

        if (!cancelled) {
          setRcAppUserId(currentId);
          setRcReady(currentId === String(user.uid)); // garde-fou
        }

        // (debug safe)
        console.log("[RC] logIn created:", created);
        console.log("[RC] appUserId:", currentId);
        console.log("[RC] originalAppUserId:", customerInfo?.originalAppUserId);
      } catch (e) {
        console.log("[RC] init/logIn error:", e?.message || e);
        if (!cancelled) {
          setRcReady(false);
          setRcAppUserId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user?.uid]);

  const value = useMemo(() => {
    const initializing = !authReady;

    return {
      user,
      authReady,
      webBridged,
      initializing,

      // ✅ expose RC readiness
      rcReady,
      rcAppUserId,

      signOut: async () => {
        // 1) Firebase
        try {
          await RNFBAuth().signOut();
        } catch (e) {
          console.log("[Auth] signOut native:", e?.message || String(e));
        }

        // 2) Web SDK (si utilisé)
        try {
          await webSignOut(webAuth);
        } catch {}

        // 3) RevenueCat: ✅ logOut ICI seulement
        try {
          await Purchases.logOut();
        } catch (e) {
          console.log("[RC] logOut error:", e?.message || e);
        }

        setWebBridged(false);
        setRcReady(false);
        setRcAppUserId(null);
      },

      waitForAuthReady: () =>
        authReady
          ? Promise.resolve()
          : new Promise((resolve) => {
              const iv = setInterval(() => {
                if (authReady) {
                  clearInterval(iv);
                  resolve();
                }
              }, 50);
            }),

      waitForBridge: () =>
        webBridged
          ? Promise.resolve()
          : new Promise((resolve) => {
              const iv = setInterval(() => {
                if (webBridged) {
                  clearInterval(iv);
                  resolve();
                }
              }, 50);
            }),

      // ✅ pour empêcher un achat tant que RC pas aligné sur uid
      waitForRcReady: () =>
        rcReady
          ? Promise.resolve()
          : new Promise((resolve) => {
              const iv = setInterval(() => {
                if (rcReady) {
                  clearInterval(iv);
                  resolve();
                }
              }, 50);
            }),
    };
  }, [user, authReady, webBridged, rcReady, rcAppUserId]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function useAuthSafe() {
  try {
    return useAuth();
  } catch {
    return {
      user: null,
      authReady: false,
      webBridged: false,
      initializing: true,
      rcReady: false,
      rcAppUserId: null,
      signOut: async () => {},
      waitForAuthReady: async () => {},
      waitForBridge: async () => {},
      waitForRcReady: async () => {},
    };
  }
}