import auth from "@react-native-firebase/auth";

export function safeOnSnapshot(refOrQuery, onNext, onError) {
  try {
    return refOrQuery.onSnapshot(
      (snap) => {
        if (!snap) return; // évite null
        onNext?.(snap);
      },
      (err) => {
        // ✅ ignore les erreurs si user est déjà logout
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