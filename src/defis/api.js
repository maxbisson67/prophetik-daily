// src/defis/api.js
import {
  addDoc, collection, serverTimestamp,
  doc, getDoc
} from 'firebase/firestore';
import { db } from '@src/lib/firebase';

/**
 * Vérifie côté client si uid est owner du groupe:
 * - soit membership role === "owner" (group_memberships/{groupId}_{uid})
 * - soit groups/{groupId}.ownerId === uid
 */
async function isGroupMemberOrOwnerClientCheck(groupId: string, uid: string) {
  try {
    if (!groupId || !uid) return false;

    // 1) Membership doc (id = "<groupId>_<uid>")
    const gmRef = doc(db, 'group_memberships', `${groupId}_${uid}`);
    const gmSnap = await getDoc(gmRef);
    if (gmSnap.exists()) {
      const gm = gmSnap.data() || {};
      // active: default true if missing
      const isActive = gm.active !== false;
      const role = (gm.role || 'member').toLowerCase();
      if (isActive && (role === 'member' || role === 'owner')) return true;
    }

    // 2) Fallback: owner of the group
    const gRef = doc(db, 'groups', String(groupId));
    const gSnap = await getDoc(gRef);
    if (gSnap.exists() && gSnap.data()?.ownerId === uid) return true;

    return false;
  } catch (e) {
    console.warn('[isGroupMemberOrOwnerClientCheck] error:', e?.code || e?.message || e);
    // Be permissive in UI and let security rules be the source of truth:
    return false;
  }
}

/**
 * Crée un défi.
 * Requis:  { groupId, title, type, gameDate, createdBy }
 * Optionnels: { participationCost, status='active', firstGameUTC, signupDeadline }
 * ⚠️ Les règles exigent: isGroupOwner(groupId) ET createdBy == request.auth.uid
 */
export async function createDefi(input) {
  const {
    groupId,
    title,
    type,               // entier (1..5)
    gameDate,           // "YYYY-MM-DD" (string)
    createdBy,          // uid (OBLIGATOIRE)
    participationCost,  // entier (optionnel)
    status = 'active',
    firstGameUTC = null,    // Date | ISO string | null
    signupDeadline = null,  // Date | ISO string | null
  } = input || {};

  // Garde-fous minimum
  if (!groupId) throw new Error('groupId requis');
  if (!title) throw new Error('title requis');
  if (!type) throw new Error('type requis');
  if (!gameDate) throw new Error('gameDate requis');
  if (!createdBy) throw new Error('createdBy (uid) requis');

  

  // Pré-vérif owner (évite un permission-denied silencieux)
  const okOwner = await isGroupMemberOrOwnerClientCheck(groupId, createdBy);
  if (!okOwner) {
    throw new Error("Création refusée: l'utilisateur n'est pas owner du groupe.");
  }

  // Normalise les dates en Date pour Firestore (Timestamp côté serveur)
  const toDate = (v) => (v instanceof Date ? v : (v ? new Date(v) : null));

  const payload = {
    groupId: String(groupId),
    title: String(title),
    type: Number(type),
    gameDate: String(gameDate),
    createdBy: String(createdBy),             // ⚠️ requis par les règles
    participationCost: participationCost ?? null,
    status,
    firstGameUTC: toDate(firstGameUTC) || undefined,
    signupDeadline: toDate(signupDeadline) || undefined,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Nettoyage des undefined
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  // Ecrit le défi
  const defisCol = collection(db, 'defis');
 
  const defiRef = await addDoc(defisCol, payload);

  return { id: defiRef.id };
}