// functions/publicProfileMirror.js
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, FieldValue } from "./utils.js";

export const mirrorParticipantToPublic = onDocumentWritten(
  "participants/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after?.data() || null;

    if (!after) {
      // participant supprimé → on peut soit supprimer le profil public, soit le marquer private
      await db.collection("profiles_public").doc(uid).set(
        { visibility: "private", updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return;
    }

    const displayName =
      after.displayName ||
      (after.email ? String(after.email).split("@")[0] : "Invité");

    const avatarUrl =
      after.photoURL || after.avatarUrl || after.photoUrl || after.avatar || null;

    await db.collection("profiles_public").doc(uid).set(
      {
        displayName,
        avatarUrl: avatarUrl || null,
        visibility: "public",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);