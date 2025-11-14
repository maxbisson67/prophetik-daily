// src/groups/services.js (RNFB-ready)
import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Génère un code d'invitation lisible (sans 0 ni O)
function generateInviteCode(length = 8) {
  const alphabet = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let code = '';
  for (let i = 0; i < length; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export async function createGroupService({ name, description = '', initialCreditsPerMember } = {}) {
  // 1) Essai via Cloud Function (recommandé)
  try {
    const callable = functions().httpsCallable('createGroup');
    const res = await callable({ name, description, initialCreditsPerMember });
    return res.data; // { groupId, ... }
  } catch (e) {
    console.warn('[createGroupService] CF createGroup failed, fallback to direct writes:', e?.message || e);
  }

  // 2) Fallback RNFB (écriture atomique)
  const u = auth().currentUser;
  const uid = u?.uid || 'mock';
  const now = firestore.FieldValue.serverTimestamp();

  // Récupère quelques infos du participant (pour ownerName/avatar)
  let ownerName = u?.displayName || 'Invité';
  let ownerAvatar = u?.photoURL || null;
  try {
    const pSnap = await firestore().doc(`participants/${uid}`).get();
    if (pSnap.exists) {
      const p = pSnap.data() || {};
      ownerName =
        p.displayName ||
        (p.email ? String(p.email).split('@')[0] : ownerName) ||
        ownerName;
      ownerAvatar = p.photoURL || p.avatarUrl || ownerAvatar || null;
    }
  } catch {}

  const groupRef = firestore().collection('groups').doc(); // auto-ID
  const groupId = groupRef.id;
  const gmRef = firestore().doc(`group_memberships/${groupId}_${uid}`);

  const batch = firestore().batch();

  batch.set(groupRef, {
    name: String(name || '').trim(),
    description: String(description || '').trim(),
    isPrivate: true,
    status: 'active',
    createdBy: uid,
    ownerId: uid,
    ownerName,
    ownerAvatarUrl: ownerAvatar || null,
    codeInvitation: generateInviteCode(8),
    createdAt: now,
    updatedAt: now,
  });

  // ⚠️ Aligne bien sur ton schéma courant: champ `uid` (et non `userId`)
  batch.set(gmRef, {
    groupId,
    uid,
    role: 'owner',
    active: true,
    status: 'active',
    displayName: ownerName,
    avatarUrl: ownerAvatar || null,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();
  return { groupId };
}