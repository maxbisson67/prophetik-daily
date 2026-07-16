import { registerFirestoreListener } from "@src/lib/firestoreListenRegistry";

function extractPath(refOrQuery) {
  try {
    if (refOrQuery?.path) return String(refOrQuery.path);
    if (refOrQuery?._query?.path) return String(refOrQuery._query.path);
    if (refOrQuery?._collectionPath) return String(refOrQuery._collectionPath);
    if (Array.isArray(refOrQuery?._segments)) return refOrQuery._segments.join("/");
    return null;
  } catch {
    return null;
  }
}

function wrapFsError(e, tag, path) {
  const code = String(e?.code || "");
  const message = String(e?.message || e || "");
  return { ...e, code, message, __tag: tag, __path: path || null };
}

const __lastDeniedLogAt = new Map();

function shouldLogDenied(key, windowMs = 3000) {
  const now = Date.now();
  const last = __lastDeniedLogAt.get(key) || 0;
  if (now - last < windowMs) return false;
  __lastDeniedLogAt.set(key, now);
  return true;
}

/**
 * Listener Firestore instrumenté.
 * @param {object} [options] — { screen, logAttach }
 */
export function listenRNFB(refOrQuery, onNext, tag, onError, options = {}) {
  const path = extractPath(refOrQuery);
  const screen = options?.screen || null;

  return registerFirestoreListener({
    tag,
    path,
    screen,
    subscribe: (onRegistryNext) =>
      refOrQuery.onSnapshot(
        (snap) => {
          if (!snap) {
            if (__DEV__) {
              console.warn(`[FS NULL SNAP] tag=${tag} path=${path || "?"}`);
            }
            return;
          }
          onRegistryNext(snap);
          onNext?.(snap);
        },
        (e) => {
          const err = wrapFsError(e, tag, path);
          const code = String(err?.code || "");

          if (code.includes("permission-denied")) {
            const key = `${tag}|${path || "?"}|${code}`;
            if (shouldLogDenied(key)) {
              console.log(`[FS DENIED] tag=${tag} path=${path || "?"} msg=${err.message}`);
              if (__DEV__) {
                console.log(new Error(`[FS:${tag}]`).stack);
              }
            }
          }

          onError?.(err);
        }
      ),
  });
}
