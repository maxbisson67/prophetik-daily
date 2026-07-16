// src/participants/api.js (RNFB)
import firestore from '@react-native-firebase/firestore';
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";

const db = firestore();

/**
 * Crée un participant s'il n'existe pas déjà.
 * Retourne true si créé, false sinon.
 */
export async function createParticipantIfMissing(uid, { name, email, avatarUrl = null }) {
  if (!uid) throw new Error('uid manquant');

  const ref = db.collection('participants').doc(String(uid));
  const snap = await ref.get();
  if (snapshotExists(snap)) return false; // déjà présent

  await ref.set({
    name: name ?? '',
    email: email ?? '',
    creditCents: 0,
    avatarUrl,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return true; // créé
}

/**
 * Met à jour partiellement un participant.
 */
export async function updateParticipant(uid, partial) {
  if (!uid) throw new Error('uid manquant');

  const ref = db.collection('participants').doc(String(uid));
  await ref.update({
    ...partial,
    // tu peux décommenter si tu veux garder une trace des MAJ
    // updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}