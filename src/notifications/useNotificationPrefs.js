import { useCallback, useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { useAuth } from "@src/auth/SafeAuthProvider";
import {
  NOTIFICATION_PREF_KEYS,
  resolveNotificationPrefs,
} from "@src/notifications/notificationPrefs";

export { NOTIFICATION_PREF_KEYS };

export function useNotificationPrefs() {
  const { user, authReady } = useAuth();
  const uid = user?.uid || null;

  const [prefs, setPrefs] = useState(() => resolveNotificationPrefs(null));
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      setPrefs(resolveNotificationPrefs(null));
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = firestore()
      .collection("participants")
      .doc(uid)
      .onSnapshot(
        (snap) => {
          const raw = snap.exists ? snap.data()?.notificationPrefs : null;
          setPrefs(resolveNotificationPrefs(raw));
          setLoading(false);
        },
        () => setLoading(false)
      );

    return () => unsub();
  }, [authReady, uid]);

  const setPref = useCallback(
    async (key, value) => {
      if (!uid || !key) return;
      const next = { ...prefs, [key]: value === true };
      setPrefs(next);
      setSavingKey(key);

      try {
        await firestore()
          .collection("participants")
          .doc(uid)
          .set({ notificationPrefs: next }, { merge: true });
      } finally {
        setSavingKey(null);
      }
    },
    [uid, prefs]
  );

  return { prefs, loading, savingKey, setPref, uid };
}
