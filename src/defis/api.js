// src/defis/api.js
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@src/lib/firebase';

/**
 * Crée un défi.
 * Attend au minimum: { groupId, title, type, gameDate, createdBy, participationCost }
 * Optionnels persistés: { status, firstGameUTC, signupDeadline }
 */
export async function createDefi(input) {
  const {
    groupId,
    title,
    type,               // entier (1..5)
    gameDate,           // "YYYY-MM-DD" (string)
    createdBy,          // uid
    participationCost,  // entier
    status = 'active',  // 👈 par défaut "active" si non fourni
    firstGameUTC = null,    // Date ou ISO string
    signupDeadline = null,  // Date ou ISO string
  } = input || {};

  if (!groupId) throw new Error('groupId requis');
  if (!type) throw new Error('type requis');
  if (!gameDate) throw new Error('gameDate requis');

  // Normalise les dates en Date pour Firestore (Timestamp)
  const toDate = (v) => (v instanceof Date ? v : (v ? new Date(v) : null));

  const payload = {
    groupId,
    title,
    type,
    gameDate,
    createdBy: createdBy || null,
    participationCost: participationCost ?? null,
    status, // 👈 on respecte le statut fourni
    firstGameUTC: toDate(firstGameUTC) || undefined,
    signupDeadline: toDate(signupDeadline) || undefined,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Nettoie les undefined
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  // Ecrit le défi
  const defisCol = collection(db, 'defis');
  const defiRef = await addDoc(defisCol, payload);

  // (Facultatif) Si tu utilises un index de relation, dé-commente:
  // await addDoc(collection(db, 'group_defis'), {
  //   groupId,
  //   defiId: defiRef.id,
  //   status,
  //   createdAt: serverTimestamp(),
  // });

  return { id: defiRef.id };
}