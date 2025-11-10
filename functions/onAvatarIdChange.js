// ESM + Functions v2
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import crypto from 'crypto';

// Assumes initializeApp() is called once in src/index.js
const db = getFirestore();
const storage = getStorage();

/**
 * Copies catalog avatar to a versioned per-user path and updates profiles_public/{uid}
 * with a cache-busted download URL whenever avatarId changes.
 *
 * Writes to: profiles_public/{uid}
 * Reads:     storage://catalog_avatars/<avatarId>.png
 * Writes:    storage://user-avatars/<uid>/<ts>-<avatarId>.png
 */
export const onAvatarIdChange = onDocumentWritten('profiles_public/{uid}', async (event) => {
  const uid = event.params.uid;

  const before = event.data?.before?.data() || {};
  const after  = event.data?.after?.data()  || {};

  // Deleted or no data -> nothing to do
  if (!after) return;

  const prevId = String(before.avatarId || '').trim();
  const nextId = String(after.avatarId || '').trim();

  // No change or empty
  if (!nextId || prevId === nextId) return;

  const bucket = storage.bucket(); // default bucket
  const srcPath = `catalog_avatars/${nextId}.png`;
  const srcFile = bucket.file(srcPath);

  const [exists] = await srcFile.exists();
  if (!exists) {
    logger.warn(`[onAvatarIdChange] Source not found: ${srcPath} (uid=${uid})`);
    return;
  }

  // Versioned destination to defeat caches at the byte level
  const ts = Date.now();
  const dstPath = `user-avatars/${uid}/${ts}-${nextId}.png`;
  const dstFile = bucket.file(dstPath);

  await srcFile.copy(dstFile);

  // Strong cache policy + a fresh permanent download token
  const token = crypto.randomUUID();
  await dstFile.setMetadata({
    cacheControl: 'no-store, max-age=0, must-revalidate',
    metadata: { firebaseStorageDownloadTokens: token },
  });

  const bucketName = bucket.name; // e.g. "capitaine.firebasestorage.app"
  const downloadURL =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}` +
    `/o/${encodeURIComponent(dstPath)}?alt=media&token=${encodeURIComponent(token)}`;

  await db.doc(`profiles_public/${uid}`).update({
    avatarUrl: downloadURL,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('[onAvatarIdChange] Updated avatarUrl', { uid, avatarId: nextId, dstPath });
});