// src/groups/services.js
import { httpsCallable } from 'firebase/functions';
import { functions, db, auth } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function createGroupService({ name, description, initialCreditsPerMember }) {
  try {
    const fn = httpsCallable(functions, 'createGroup');
    const res = await fn({ name, description, initialCreditsPerMember });
    return res.data; // { groupId }
  } catch (e) {
    console.warn('[MOCK] createGroup fallback:', e?.message);
    const groupRef = doc(db, 'groups', cryptoRandomId());
    const uid = auth.currentUser?.uid || 'mock';
    await setDoc(groupRef, {
      name,
      description,
      isPrivate: true,
      createdBy: uid,
      createdAt: serverTimestamp(),
      initialCreditsPerMember,
      status: 'active'
    });
    const mRef = doc(db, 'group_memberships', `${groupRef.id}_${uid}`);
    await setDoc(mRef, { groupId: groupRef.id, userId: uid, role: 'owner', joinedAt: serverTimestamp(), active: true });
    return { groupId: groupRef.id };
  }
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}