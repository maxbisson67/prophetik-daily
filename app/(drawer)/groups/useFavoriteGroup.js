// src/hooks/useFavoriteGroup.js
import firestore from '@react-native-firebase/firestore';

export default function useFavoriteGroup(meDoc) {
  const favoriteGroupId = meDoc?.favoriteGroupId || null;

  async function setFavoriteGroup(uid, groupId) {
    if (!uid) throw new Error('Not authenticated');
    const ref = firestore().doc(`participants/${uid}`);
    await ref.set({ favoriteGroupId: groupId || null }, { merge: true });
  }

  return { favoriteGroupId, setFavoriteGroup };
}