import { Platform } from "react-native";
import { readDocSnapshot } from "@src/lib/safeSnapshot";

function readSnap(snap) {
  const { exists, data } = readDocSnapshot(snap, { fallbackData: {} });
  return { exists, data };
}

/** Subscribe to a top-level Firestore doc path, e.g. `nhl_standings/current`. */
export function subscribeFirestoreDoc(path, onNext, onError) {
  const emit = (snap) => {
    if (!snap) return;
    onNext(readSnap(snap));
  };
  if (Platform.OS === "web") {
    const { doc, onSnapshot, getFirestore } = require("firebase/firestore");
    const { app } = require("@src/lib/firebase");
    const db = getFirestore(app);
    const ref = doc(db, path);
    return onSnapshot(
      ref,
      emit,
      onError
    );
  }

  const firestore = require("@react-native-firebase/firestore").default;
  return firestore()
    .doc(path)
    .onSnapshot(
      emit,
      onError
    );
}
