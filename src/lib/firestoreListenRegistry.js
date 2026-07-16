import { snapshotExists } from "@src/lib/safeSnapshot";
/**
 * Registre des listeners Firestore (Phase 0 — mesure).
 * Compte les listeners actifs et estime les lectures par snapshot.
 */

const listeners = new Map();
let listenerSeq = 0;
let totalSnapshotReads = 0;
let snapshotEventCount = 0;

const listenersByTag = new Map();
const listenersByScreen = new Map();

function bumpCounter(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function decCounter(map, key) {
  const next = (map.get(key) || 0) - 1;
  if (next <= 0) map.delete(key);
  else map.set(key, next);
}

function countDocs(snap) {
  if (!snap) return 0;
  if (typeof snap.size === "number") return snap.size;
  if (typeof snap.exists === "boolean") return snapshotExists(snap) ? 1 : 0;
  if (Array.isArray((snap?.docs ?? []))) return (snap?.docs ?? []).length;
  return 1;
}

export function registerFirestoreListener({
  tag = "unknown",
  path = null,
  screen = null,
  subscribe,
}) {
  const id = ++listenerSeq;
  const meta = { id, tag, path, screen, attachedAt: Date.now() };

  listeners.set(id, meta);
  bumpCounter(listenersByTag, tag);
  if (screen) bumpCounter(listenersByScreen, screen);

  if (__DEV__) {
    console.log(
      `[FS REG +] #${id} tag=${tag}${screen ? ` screen=${screen}` : ""}${path ? ` path=${path}` : ""} active=${listeners.size}`
    );
  }

  const rawUnsub = subscribe((snap) => {
    const docs = countDocs(snap);
    totalSnapshotReads += docs;
    snapshotEventCount += 1;

    if (__DEV__ && docs > 0) {
      console.log(
        `[FS READ ~] #${id} tag=${tag} docs=${docs} totalReads≈${totalSnapshotReads}`
      );
    }
  });

  return () => {
    try {
      rawUnsub?.();
    } catch {}

    if (listeners.has(id)) {
      listeners.delete(id);
      decCounter(listenersByTag, tag);
      if (screen) decCounter(listenersByScreen, screen);

      if (__DEV__) {
        console.log(
          `[FS REG -] #${id} tag=${tag} active=${listeners.size}`
        );
      }
    }
  };
}

export function getFirestoreListenStats() {
  const byTag = Object.fromEntries(
    [...listenersByTag.entries()].sort((a, b) => b[1] - a[1])
  );
  const byScreen = Object.fromEntries(
    [...listenersByScreen.entries()].sort((a, b) => b[1] - a[1])
  );

  return {
    activeListeners: listeners.size,
    snapshotEvents: snapshotEventCount,
    estimatedDocumentReads: totalSnapshotReads,
    byTag,
    byScreen,
    listeners: [...listeners.values()].map((x) => ({
      id: x.id,
      tag: x.tag,
      path: x.path,
      screen: x.screen,
    })),
  };
}

export function resetFirestoreListenStats() {
  totalSnapshotReads = 0;
  snapshotEventCount = 0;
}
