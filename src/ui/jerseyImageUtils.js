import { Platform } from "react-native";

/** Keep URLs intact; only trim whitespace. */
export function normalizeJerseyUrl(url) {
  const s = String(url || "").trim();
  return s || null;
}

export function isFirebaseDownloadUrl(url) {
  return /firebasestorage\.googleapis\.com\/v0\/b\/.+\/o\/.+\?alt=media&token=/.test(
    String(url || "")
  );
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

export function jerseyAnimatedLayerProps(size) {
  return Platform.OS === "ios"
    ? {
        needsOffscreenAlphaCompositing: true,
        renderToHardwareTextureAndroid: true,
        width: size,
        height: size,
      }
    : {
        width: size,
        height: size,
      };
}
