// (drawer)/subscriptions/useEntitlement.js
import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

/**
 * Source de vérité (MVP):
 * entitlements/{uid}
 * {
 *   tier: "free" | "pro" | "vip",
 *   active: true,
 *   updatedAt: serverTimestamp()
 * }
 *
 * Si doc absent -> free
 */
export default function useEntitlement(uid) {
  const [loading, setLoading] = useState(!!uid);
  const [tier, setTier] = useState("free");
  const [active, setActive] = useState(true);
  const [error, setError] = useState(null);

  const key = useMemo(() => String(uid || ""), [uid]);

  useEffect(() => {
    setError(null);
    setTier("free");
    setActive(true);

    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore().collection("entitlements").doc(String(uid));

    const unsub = ref.onSnapshot(
      (snap) => {
        if (!snap.exists) {
          setTier("free");
          setActive(true);
          setLoading(false);
          return;
        }

        const d = snap.data() || {};
        const t = String(d.tier || "free").toLowerCase();

        setTier(t === "vip" || t === "pro" ? t : "free");
        setActive(d.active !== false);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setTier("free");
        setActive(true);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [key]);

  return { loading, tier, active, error };
}