// src/credits/useCredits.js
import { useEffect, useState } from "react";
import { subscribeCredits, freeTopUp } from "./api";
import { useAuth } from "@src/auth/AuthProvider";

export function useCredits() {
  const { user, initializing } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (initializing) return;
    if (!user) { setCredits(0); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeCredits(user.uid, (c) => {
      setCredits(c);
      setLoading(false);
    });
    return () => unsub();
  }, [user, initializing]);

  const topUpFree = async () => {
    try {
      const res = await freeTopUp();
      return res;
    } catch (e) {
      setErr(e);
      throw e;
    }
  };

  return { credits, loading, error: err, topUpFree };
}