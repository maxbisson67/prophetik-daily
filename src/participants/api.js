// src/participants/api.js
import { db } from '../lib/firebase';
import {
  doc, getDoc, setDoc, serverTimestamp, updateDoc
} from 'firebase/firestore';

export async function createParticipantIfMissing(uid, { name, email, avatarUrl = null }) {
  if (!uid) throw new Error('uid manquant');
  const ref = doc(db, 'participants', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return false; // déjà présent

  await setDoc(ref, {
    name: name ?? '',
    email: email ?? '',
    creditCents: 0,
    avatarUrl,
    createdAt: serverTimestamp(),
  });
  return true; // créé
}

export async function updateParticipant(uid, partial) {
  const ref = doc(db, 'participants', uid);
  await updateDoc(ref, {
    ...partial,
    // si tu veux suivre la dernière maj:
    // updatedAt: serverTimestamp(),
  });
}