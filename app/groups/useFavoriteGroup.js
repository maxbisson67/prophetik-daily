import { doc, updateDoc } from "firebase/firestore";
import { db } from "@src/lib/firebase";

export default function useFavoriteGroup(meDoc) {
  const favoriteGroupId = meDoc?.favoriteGroupId || null;

  async function setFavoriteGroup(uid, groupId) {
    if (!uid) throw new Error("Not authenticated");
    const ref = doc(db, "participants", uid);
    await updateDoc(ref, { favoriteGroupId: groupId || null });
  }

  return { favoriteGroupId, setFavoriteGroup };
}