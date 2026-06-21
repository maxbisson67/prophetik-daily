import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const bundleId = process.argv[2];
const uid = process.argv[3];

const bundleSnap = await db.doc(`team_prediction_bundles/${bundleId}`).get();
const bundle = bundleSnap.data() || {};
console.log("games:", JSON.stringify(bundle.games, null, 2));

if (uid) {
  const entrySnap = await db.doc(`team_prediction_bundles/${bundleId}/entries/${uid}`).get();
  console.log("entry:", JSON.stringify(entrySnap.data(), null, 2));
}
