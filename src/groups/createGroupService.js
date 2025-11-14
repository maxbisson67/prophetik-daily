// src/groups/services.js (RNFB)
// Conversion vers @react-native-firebase/firestore

import firestore from '@react-native-firebase/firestore';

/** Générateur déjà en place… */
function generateCodeInvitation(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'; // sans 0 ni O
  let code = '';
  for (let i = 0; i < length; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/**
 * Crée un groupe + membership owner (atomique).
 * @param {{name: string, description?: string, uid: string}} params
 * @returns {Promise<{groupId: string, codeInvitation: string}>}
 */
export async function createGroupService({ name, description = '', uid }) {
  if (!uid) throw new Error('uid manquant');

  const now = firestore.FieldValue.serverTimestamp();

  // 1) Profil participant (pour nom/avatar)
  const pSnap = await firestore().doc(`participants/${uid}`).get();
  const p = pSnap.exists ? (pSnap.data() || {}) : {};
  const displayName =
    p.displayName ||
    (p.email ? String(p.email).split('@')[0] : '') ||
    'Invité';
  const avatarUrl =
    p.photoURL || p.avatarUrl || p.photoUrl || p.avatar || null;

  // 2) Réfs & IDs
  const groupRef = firestore().collection('groups').doc(); // auto-ID
  const groupId = groupRef.id;
  const codeInvitation = generateCodeInvitation(8);
  const gmRef = firestore().doc(`group_memberships/${groupId}_${uid}`);

  // 3) Batch (écriture atomique)
  const batch = firestore().batch();

  batch.set(groupRef, {
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

  batch.set(gmRef, {
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

  await batch.commit();

  return { groupId, codeInvitation };
}