/**
 * Migre pickResults.{gameId} (clés plates) vers pickResults.{gameId} (map).
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const bundleId = process.argv[2];

function collectPickResults(entry = {}) {
  const map = { ...(entry.pickResults || {}) };
  const flatKeys = [];

  for (const [key, value] of Object.entries(entry)) {
    if (!key.startsWith("pickResults.")) continue;
    if (!value || typeof value !== "object") continue;
    const gameId = key.slice("pickResults.".length);
    map[gameId] = value;
    flatKeys.push(key);
  }

  return { map, flatKeys };
}

async function repairBundle(id) {
  const entriesSnap = await db.collection(`team_prediction_bundles/${id}/entries`).get();
  let fixed = 0;

  for (const doc of entriesSnap.docs) {
    const entry = doc.data() || {};
    const { map, flatKeys } = collectPickResults(entry);
    if (!flatKeys.length) continue;

    const update = { pickResults: map, updatedAt: FieldValue.serverTimestamp() };
    for (const key of flatKeys) {
      update[key] = FieldValue.delete();
    }

    await doc.ref.set(update, { merge: true });
    fixed += 1;
    console.log("fixed entry", id, doc.id, "flatKeys:", flatKeys.length);
  }

  return fixed;
}

if (bundleId) {
  const fixed = await repairBundle(bundleId);
  console.log(JSON.stringify({ ok: true, bundleId, fixedEntries: fixed }));
  process.exit(0);
}

const snap = await db.collection("team_prediction_bundles").get();
let total = 0;
for (const doc of snap.docs) {
  total += await repairBundle(doc.id);
}
console.log(JSON.stringify({ ok: true, bundles: snap.size, fixedEntries: total }));
