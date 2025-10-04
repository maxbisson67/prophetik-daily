// src/auth/AuthProvider.js
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { registerPushTokenForUser } from '@src/lib/push/registerPushToken';


const AuthCtx = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  // Dès qu'on a un user connecté => enregistrer/mettre à jour le token push
  useEffect(() => {
    const uid = user?.uid || null;
    if (!uid) return;

    // évite un double appel si uid identique
    if (lastRegisteredUidRef.current === uid) return;
    lastRegisteredUidRef.current = uid;

    registerPushTokenForUser(uid).catch((err) => {
      // non bloquant : on log et on continue
      console.log('Push token registration failed:', err);
    });
  }, [user?.uid]);


  return (
    <AuthCtx.Provider value={{ user, initializing }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}