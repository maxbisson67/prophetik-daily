// utils/fsListen.js (ou direct dans AccueilScreen si tu veux)
function extractPath(refOrQuery) {
  try {
    // DocumentReference: .path
    if (refOrQuery?.path) return String(refOrQuery.path);

    // Query RNFB: souvent ._query / ._collectionPath (selon versions)
    if (refOrQuery?._query?.path) return String(refOrQuery._query.path);
    if (refOrQuery?._collectionPath) return String(refOrQuery._collectionPath);

    // Fallback: certaines queries ont ._segments
    if (Array.isArray(refOrQuery?._segments)) return refOrQuery._segments.join("/");

    return null;
  } catch {
    return null;
  }
}

function wrapFsError(e, tag, path) {
  // RNFB error: { code, message, nativeErrorCode, ... }
  const code = String(e?.code || "");
  const message = String(e?.message || e || "");
  return {
    ...e,
    code,
    message,
    __tag: tag,
    __path: path || null,
  };
}

// Anti-spam: 1 log / (tag+path+code) / 3s
const __lastDeniedLogAt = new Map();
function shouldLogDenied(key, windowMs = 3000) {
  const now = Date.now();
  const last = __lastDeniedLogAt.get(key) || 0;
  if (now - last < windowMs) return false;
  __lastDeniedLogAt.set(key, now);
  return true;
}

export function listenRNFB(refOrQuery, onNext, tag, onError) {
  const path = extractPath(refOrQuery);

  return refOrQuery.onSnapshot(
    onNext,
    (e) => {
      const err = wrapFsError(e, tag, path);
      const code = String(err?.code || "");

      if (code.includes("permission-denied")) {
        const key = `${tag}|${path || "?"}|${code}`;
        if (shouldLogDenied(key)) {
          console.log(`[FS DENIED] tag=${tag} path=${path || "?"} msg=${err.message}`);

          if (__DEV__) {
            // stack pour savoir QUI a attaché ce listener
            console.log(new Error(`[FS:${tag}]`).stack);
          }
        }
      } else if (__DEV__) {
        // optionnel: log des autres erreurs inattendues
        // console.log(`[FS ERROR] tag=${tag} path=${path || "?"}`, code, err.message);
      }

      onError?.(err);
    }
  );
}