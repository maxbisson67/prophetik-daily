// src/auth/AuthProvider.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

const Ctx = createContext({ user: null, initializing: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInit] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setInit(false); });
    return () => unsub();
  }, []);

  return <Ctx.Provider value={{ user, initializing }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }