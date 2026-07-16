// app/(drawer)/subscriptions/useEntitlement.js
import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";

export default function useEntitlement(uid) {
  const [loading, setLoading] = useState(!!uid);

  const [tier, setTier] = useState("free");
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [tiers, setTiers] = useState({ pro: null, vip: null }); // ✅ NEW
  const [source, setSource] = useState(null);
  const [lastEventType, setLastEventType] = useState(null);

  const [error, setError] = useState(null);

  const key = useMemo(() => String(uid || ""), [uid]);

  useEffect(() => {
    // reset local state
    setError(null);
    setTier("free");
    setActive(false);
    setExpiresAt(null);
    setTiers({ pro: null, vip: null }); // ✅ NEW
    setSource(null);
    setLastEventType(null);

    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore().collection("entitlements").doc(String(uid));

    const unsub = ref.onSnapshot(
      (snap) => {
        if (!snapshotExists(snap)) {
          setTier("free");
          setActive(false);
          setExpiresAt(null);
          setTiers({ pro: null, vip: null }); // ✅ NEW
          setSource(null);
          setLastEventType(null);
          setLoading(false);
          return;
        }

        const d = snapshotData(snap) || {};
        const t = String(d.tier || "free").toLowerCase();
        const normalizedTier = t === "vip" || t === "pro" ? t : "free";

        setTier(normalizedTier);
        setActive(d.active === true);
        setExpiresAt(d.expiresAt || null);

        // ✅ NEW: tiers
        const rawTiers = d.tiers || {};
        const normTierObj = (x) => (x && typeof x === "object" ? x : null);
        setTiers({
          pro: normTierObj(rawTiers.pro),
          vip: normTierObj(rawTiers.vip),
        });

        setSource(d.source || null);
        setLastEventType(d.lastEventType || null);

        setLoading(false);
      },
      (e) => {
        setError(e);
        setTier("free");
        setActive(false);
        setExpiresAt(null);
        setTiers({ pro: null, vip: null }); // ✅ NEW
        setSource(null);
        setLastEventType(null);
        setLoading(false);
      }
    );

    return () => {
      try { unsub?.(); } catch {}
    };
  }, [key]);

  return { loading, tier, active, expiresAt, tiers, source, lastEventType, error }; // ✅ tiers
}