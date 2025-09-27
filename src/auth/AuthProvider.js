import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getAuth } from 'firebase/auth';

const AuthCtx = createContext(undefined);
export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setUser(u ?? null);
      setBooting(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, booting }}>
      {children}
    </AuthCtx.Provider>
  );
}