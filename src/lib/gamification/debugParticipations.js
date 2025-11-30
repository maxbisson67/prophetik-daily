// src/lib/gamification/debugParticipations.js
import { Platform } from "react-native";

const DEBUG_GROUP_ID = "debug-group-7lwVnD9GPpe69u70PULIhDZLbGs2-1764430299836"; // 👈 mets ici un vrai groupId où tu es dans group_members

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
 * Crée UNE participation dans un groupe de test, pour déclencher onParticipationCreated.
 *  -> onParticipationCreated augmente les compteurs + crédit si seuil 3/5 atteint.
 */
export async function createDebugParticipationOnce(eventId, participantId) {
  const { mode, db } = getFirestoreClient();

  const groupId = DEBUG_GROUP_ID;
  const defiId = `debug-${eventId}-${Date.now()}`;

  if (mode === "web") {
    const { doc, setDoc, serverTimestamp } = require("firebase/firestore");

    const participationRef = doc(
      db,
      "groups",
      groupId,
      "defis",
      defiId,
      "participations",
      participantId
    );

    await setDoc(participationRef, {
      createdAt: serverTimestamp(),
      source: "debug",
      eventId,
    });
  } else {
    // RNFirebase
    const participationRef = db
      .collection("groups")
      .doc(groupId)
      .collection("defis")
      .doc(defiId)
      .collection("participations")
      .doc(participantId);

    await participationRef.set({
      createdAt: db.FieldValue?.serverTimestamp?.() ?? new Date(),
      source: "debug",
      eventId,
    });
  }
}

/**
 * Simule 3 participations à la suite pour déclencher justHitThreeStreak
 * (au 3ᵉ appel, ta CF va faire +1 crédit et reset à 0).
 */
export async function simulateThreeHits(participantId) {
  for (let i = 0; i < 3; i++) {
    await createDebugParticipationOnce("JUST_HIT_THREE", participantId);
  }
}

/**
 * Simule 5 participations à la suite pour déclencher justHitFive
 * (au 5ᵉ appel, ta CF va faire +2 crédits et reset à 0).
 */
export async function simulateFiveHits(participantId) {
  for (let i = 0; i < 5; i++) {
    await createDebugParticipationOnce("JUST_HIT_FIVE", participantId);
  }
}