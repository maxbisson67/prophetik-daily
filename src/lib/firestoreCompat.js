import { Platform } from "react-native";

function readSnap(snap) {
  const exists =
    typeof snap?.exists === "function" ? snap.exists() : !!snap?.exists;
  const data =
    typeof snap?.data === "function" ? snap.data() || {} : snap?.data || {};
  return { exists, data };
}

/** Subscribe to a top-level Firestore doc path, e.g. `nhl_standings/current`. */
export function subscribeFirestoreDoc(path, onNext, onError) {
  if (Platform.OS === "web") {
    const { doc, onSnapshot, getFirestore } = require("firebase/firestore");
    const { app } = require("@src/lib/firebase");
    const db = getFirestore(app);
    const ref = doc(db, path);
    return onSnapshot(
      ref,
      (snap) => onNext(readSnap(snap)),
      onError
    );
  }

  const firestore = require("@react-native-firebase/firestore").default;
  return firestore()
    .doc(path)
    .onSnapshot(
      (snap) => onNext(readSnap(snap)),
      onError
    );
}
