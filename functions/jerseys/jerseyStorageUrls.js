import { randomUUID } from "crypto";

export const JERSEY_STORAGE_BUCKET = "capitaine.firebasestorage.app";

export function buildFirebaseDownloadUrl(bucketName, filePath, token) {
  const encoded = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
}

export function parseJerseyStoragePath(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (s.startsWith("jerseys/generated/")) return s;

  const gcsMatch = s.match(/firebasestorage\.app\/([^?]+)/);
  if (gcsMatch) return decodeURIComponent(gcsMatch[1]);

  const firebaseMatch = s.match(/\/o\/([^?]+)/);
  if (firebaseMatch) return decodeURIComponent(firebaseMatch[1]);

  return null;
}

export function isFirebaseDownloadUrl(url) {
  return /firebasestorage\.googleapis\.com\/v0\/b\/.+\/o\/.+\?alt=media&token=/.test(
    String(url || "")
  );
}

export async function ensureFirebaseDownloadUrl(bucket, filePath) {
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  const [meta] = await file.getMetadata();
  let token = meta.metadata?.firebaseStorageDownloadTokens;

  if (!token) {
    token = randomUUID();
    await file.setMetadata({
      metadata: {
        ...(meta.metadata || {}),
        firebaseStorageDownloadTokens: token,
      },
    });
  }

  return buildFirebaseDownloadUrl(bucket.name, filePath, token);
}

export async function uploadBufferWithDownloadUrl({
  bucket,
  path,
  buffer,
  contentType = "image/png",
  metadata = {},
}) {
  const token = randomUUID();
  const file = bucket.file(path);

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public,max-age=3600",
      metadata: {
        ...metadata,
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return buildFirebaseDownloadUrl(bucket.name, path, token);
}
