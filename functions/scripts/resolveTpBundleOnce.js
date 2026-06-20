/**
 * One-off: resolve a TP bundle by ID.
 *
 * Usage (from functions/):
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/resolveTpBundleOnce.js tpb_mlb_WxGjajTBv3aGloLmBEmW_20260619
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { resolveTeamPredictionBundles } from "../teamPredictionBundles/resolveTeamPredictionBundleCore.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const bundleId = process.argv[2];

if (!bundleId) {
  console.error("Usage: node scripts/resolveTpBundleOnce.js <bundleId>");
  process.exit(1);
}

const result = await resolveTeamPredictionBundles({ db, bundleId });
console.log(JSON.stringify(result, null, 2));
