// src/groups/services.js (RNFB)

import firestore from '@react-native-firebase/firestore';

/** Générateur déjà en place… */
function generateCodeInvitation(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'; // sans 0 ni O
  let code = '';
  for (let i = 0; i < length; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/**
 * Crée un groupe + membership owner.
 * ⚠️ IMPORTANT : on ne fait plus de batch pour que les règles puissent voir le groupe.
 * @param {{name: string, description?: string, uid: string}} params
 * @returns {Promise<{groupId: string, codeInvitation: string}>}
 */
export async function createGroupService({ name, description = '', uid }) {
  if (!uid) throw new Error('uid manquant');

  const db = firestore();
  const now = firestore.FieldValue.serverTimestamp();

  // 1) Profil participant (pour nom/avatar)
  const pSnap = await db.doc(`participants/${uid}`).get();
  const p = pSnap.exists ? (pSnap.data() || {}) : {};

  const displayName =
    p.displayName ||
    (p.email ? String(p.email).split('@')[0] : '') ||
    'Invité';

  const avatarUrl =
    p.photoURL || p.avatarUrl || p.photoUrl || p.avatar || null;

  // 2) Réfs & IDs
  const groupRef = db.collection('groups').doc(); // auto-ID
  const groupId = groupRef.id;
  const codeInvitation = generateCodeInvitation(8);
  const gmRef = db.doc(`group_memberships/${groupId}_${uid}`);

  // 3) 1er write : création du groupe (règle /groups create)
  await groupRef.set({
    name: String(name || '').trim(),
    description: String(description || '').trim(),
    avatarUrl: null,
    codeInvitation,
    createdBy: uid,            // ✅ exigé par la règle /groups create
    isPrivate: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,

    // champs pratiques pour les règles/isGroupOwner
    ownerId: uid,
    ownerName: displayName,
    ownerAvatarUrl: avatarUrl || null,
  });

  // 4) 2e write : membership owner (règle /group_memberships create)
  await gmRef.set({
    groupId,
    uid,
    role: 'owner',             // ✅ autorisé car groups/{groupId}.createdBy == uid maintenant
    active: true,
    status: 'active',
    displayName,
    avatarUrl: avatarUrl || null,
    createdAt: now,
    updatedAt: now,
  });

  return { groupId, codeInvitation };
}