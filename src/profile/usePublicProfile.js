// src/profile/usePublicProfile.js
import { useEffect, useState } from "react";
import { db } from "@src/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export function usePublicProfile(uid) {
  const [loading, setLoading] = useState(!!uid);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, "profiles_public", uid);
    const un = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          setLoading(false);
          return;
        }
        const d = snap.data() || {};
        setProfile({
          id: snap.id,
          displayName: d.displayName || "Invité",
          avatarUrl: d.avatarUrl || null,
          avatarId: d.avatarId || null,
          updatedAt: d.updatedAt || null, // Firestore Timestamp (peut être null la première fois)
          visibility: d.visibility ?? "public",
        });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => { try { un?.(); } catch {} };
    //return () => un();
  }, [uid]);

  return { profile, loading };
}