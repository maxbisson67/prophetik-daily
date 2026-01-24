// functions/onAvatarIdChange.js (ESM + Functions v2)
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

function normalizeAvatarId(raw) {
  let v = String(raw || "").trim();
  // si quelqu’un a mis "catalog_avatars/xxx.png"
  v = v.replace(/^catalog_avatars\//, "");
  // enlève extension .png/.jpg/.jpeg/.webp si présente
  v = v.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  return v;
}

/**
 * Trigger: profiles_public/{uid} written
 * When avatarId changes, reads catalog_avatars/{avatarId} to fetch URL,
 * then writes:
 *  - profiles_public/{uid}.avatarUrl
 *  - participants/{uid}.avatarUrl + participants/{uid}.photoURL (compat UI)
 */
export const onAvatarIdChange = onDocumentWritten(
  "profiles_public/{uid}",
  async (event) => {
    const uid = event.params.uid;

    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};

    // Deleted or no data -> nothing to do
    if (!after) return;

    const prevId = normalizeAvatarId(before.avatarId);
    const nextId = normalizeAvatarId(after.avatarId);

    // No change or empty
    if (!nextId || prevId === nextId) return;

    logger.info("[onAvatarIdChange] fired", {
      uid,
      prevId,
      nextId,
      beforeRaw: before.avatarId || null,
      afterRaw: after.avatarId || null,
    });

    // Read catalog doc
    const catRef = db.doc(`catalog_avatars/${nextId}`);
    const catSnap = await catRef.get();

    if (!catSnap.exists) {
      logger.warn("[onAvatarIdChange] catalog doc missing", { uid, nextId });
      return;
    }

    const cat = catSnap.data() || {};
    const url = cat.url || cat.avatarUrl || cat.downloadURL || null;

    if (!url || typeof url !== "string") {
      logger.warn("[onAvatarIdChange] catalog doc has no url", {
        uid,
        nextId,
        catKeys: Object.keys(cat),
      });
      return;
    }

    // Guard: avoid useless writes if already same url
    const currentAvatarUrl = String(after.avatarUrl || "").trim();
    if (currentAvatarUrl === String(url).trim()) {
      logger.info("[onAvatarIdChange] avatarUrl already up-to-date, skipping", {
        uid,
        nextId,
      });
      // On synchronise quand même participants pour corriger les écrans legacy
      await db.doc(`participants/${uid}`).set(
        {
          avatarUrl: url,
          photoURL: url,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    // Update profiles_public
    await db.doc(`profiles_public/${uid}`).update({
      avatarUrl: url,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ✅ Sync participants too (so Accueil/other screens refresh correctly)
    await db.doc(`participants/${uid}`).set(
      {
        avatarUrl: url,
        photoURL: url, // pour les écrans qui lisent photoURL
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("[onAvatarIdChange] Updated avatarUrl (direct url) + synced participants", {
      uid,
      avatarId: nextId,
    });
  }
);