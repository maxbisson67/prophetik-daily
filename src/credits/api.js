// src/credits/api.js
import { httpsCallable } from "firebase/functions";
import { functions, db } from "@src/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/** Abonnement au solde de crédits (participants/{uid}.credits) */
export function subscribeCredits(uid, cb) {
  const ref = doc(db, "participants", uid);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? (snap.data().credits || 0) : 0));
}

/** Appelle la CF freeTopUp (ajoute +25 si autorisé) */
export async function freeTopUp() {
  const fn = httpsCallable(functions, "freeTopUp");
  const res = await fn({});
  return res.data; // { ok, credits }
}

/** Rejoindre un défi (débite stakes) — optionnel si déjà utilisé */
export async function joinDefi(groupId, defiId) {
  const fn = httpsCallable(functions, "joinDefi");
  const res = await fn({ groupId, defiId });
  return res.data; // { ok, credits, alreadyJoined? }
}

/** Clôturer un défi — optionnel */
export async function closeDefi(groupId, defiId, winners) {
  const fn = httpsCallable(functions, "closeDefi");
  const res = await fn({ groupId, defiId, winners });
  return res.data; // { ok, gainPerWinner, totalPot }
}