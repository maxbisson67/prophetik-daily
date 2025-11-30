// src/lib/gamification/debugFirsts.js
import { Platform } from "react-native";

function getFirestoreClient() {
  if (Platform.OS === "web") {
    const { getFirestore } = require("firebase/firestore");
    const { app } = require("@src/lib/firebase");
    return { mode: "web", db: getFirestore(app) };
  }

  const firestore = require("@react-native-firebase/firestore").default;
  return { mode: "native", db: firestore() };
}

/**
 * Crée un défi "debug" dans /defis
 * -> déclenche onDefiCreated
 *
 * groupId est optionnel : si non fourni, on n'écrit pas ce champ.
 */
export async function createDebugDefiForUser(uid, groupId) {
  const { mode, db } = getFirestoreClient();
  const defiId = `debug-defi-${uid}-${Date.now()}`;

  const baseData = {
    createdBy: uid,
    source: "debug",
  };

  if (groupId) {
    baseData.groupId = groupId; // 👈 seulement si défini
  }

  if (mode === "web") {
    const { doc, setDoc, serverTimestamp } = require("firebase/firestore");
    const defiRef = doc(db, "defis", defiId);
    await setDoc(defiRef, {
      ...baseData,
      createdAt: serverTimestamp(),
    });
  } else {
    const defiRef = db.collection("defis").doc(defiId);
    await defiRef.set({
      ...baseData,
      createdAt: db.FieldValue?.serverTimestamp?.() ?? new Date(),
    });
  }
}