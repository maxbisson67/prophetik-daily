// src/subscriptions/useEntitlement.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@src/lib/firebase"; // ajuste si ton export s'appelle autrement

export function useEntitlement(uid) {
  const [entitlement, setEntitlement] = useState(null);
  const [loading, setLoading] = useState(!!uid);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setEntitlement(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const ref = doc(db, "entitlements", uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setEntitlement(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
        setError(null);
      },
      (e) => {
        setEntitlement(null);
        setLoading(false);
        setError(e);
      }
    );

    return () => unsub();
  }, [uid]);

  return { entitlement, loading, error };
}