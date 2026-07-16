import auth from "@react-native-firebase/auth";

/** RNFB may invoke onSnapshot with a null snap (esp. Android). */
export function snapshotExists(snap) {
  if (!snap) return false;
  return typeof snap.exists === "function" ? snap.exists() : !!snap.exists;
}

export function snapshotData(snap, fallback = null) {
  if (!snapshotExists(snap)) return fallback;
  const raw = typeof snap.data === "function" ? snap.data() : snap.data;
  return raw ?? fallback;
}

export function snapshotId(snap) {
  return snap?.id ?? null;
}

/** Query snapshot docs — RNFB can invoke onSnapshot with a null snap on Android. */
export function snapshotDocs(snap) {
  if (!snap || !Array.isArray(snap.docs)) return [];
  return snap.docs;
}

/** Normalized doc snapshot for listeners. */
export function readDocSnapshot(snap, { fallbackData = null } = {}) {
  const exists = snapshotExists(snap);
  return {
    exists,
    id: snapshotId(snap),
    data: exists ? snapshotData(snap, fallbackData) : fallbackData,
  };
}

export function safeOnSnapshot(refOrQuery, onNext, onError) {
  try {
    return refOrQuery.onSnapshot(
      (snap) => {
        if (!snap) return;
        onNext?.(snap);
      },
      (err) => {
        // ignore errors after logout
        if (!auth().currentUser) return;
        onError?.(err);
      }
    );
  } catch (err) {
    if (!auth().currentUser) return () => {};
    onError?.(err);
    return () => {};
  }
}
