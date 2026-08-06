import storage from "@react-native-firebase/storage";
import { isFirebaseDownloadUrl, parseJerseyStoragePath } from "@src/ui/jerseyImageUtils";

const cache = new Map();

export async function resolveJerseyDownloadUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (isFirebaseDownloadUrl(raw)) return raw;

  const path = parseJerseyStoragePath(raw);
  if (!path) return raw;

  if (cache.has(path)) return cache.get(path);

  try {
    const resolved = await storage().ref(path).getDownloadURL();
    cache.set(path, resolved);
    return resolved;
  } catch (error) {
    console.warn("[resolveJerseyDownloadUrl]", path, error?.message || error);
    return raw;
  }
}

export function prefetchJerseyDownloadUrl(url) {
  return resolveJerseyDownloadUrl(url).catch(() => null);
}
