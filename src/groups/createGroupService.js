// src/groups/services.js
import { db } from '@src/lib/firebase';
import {
  collection, doc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';

// Générateur déjà en place…
function generateCodeInvitation(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'; // sans 0 ni O
  let code = '';
  for (let i = 0; i < length; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export async function createGroupService({ name, description = '', uid }) {
  if (!uid) throw new Error('uid manquant');

  // 1) Récupérer le profil participant (pour name/avatar)
  const pSnap = await getDoc(doc(db, 'participants', uid));
  const p = pSnap.exists() ? pSnap.data() : {};
  const displayName =
    p.displayName ||
    (p.email ? String(p.email).split('@')[0] : '') ||
    'Invité';
  const avatarUrl =
    p.photoURL || p.avatarUrl || p.photoUrl || p.avatar || null;

  const now = serverTimestamp();

  // 2) Créer le groupe
  const groupRef = doc(collection(db, 'groups'));
  const groupId = groupRef.id;
  const codeInvitation = generateCodeInvitation(8);

  await setDoc(groupRef, {
    name: String(name || '').trim(),
    description: String(description || '').trim(),
    avatarUrl: null,
    codeInvitation,
    createdBy: uid,
    isPrivate: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,

    // 🧩 champs pratiques pour l’affichage & règles
    ownerId: uid,
    ownerName: displayName,
    ownerAvatarUrl: avatarUrl || null,
  });

  // 3) Créer le membership owner **avec identité**
  const gmRef = doc(db, 'group_memberships', `${groupId}_${uid}`);
  await setDoc(gmRef, {
    groupId,
    uid,
    role: 'owner',
    active: true,
    status: 'active',
    displayName,
    avatarUrl: avatarUrl || null,
    createdAt: now,
    updatedAt: now,
  });

  return { groupId, codeInvitation };
}