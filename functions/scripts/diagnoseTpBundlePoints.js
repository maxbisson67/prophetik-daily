/**
 * Diagnostic points TP vs classement pour un bundle.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const bundleId = process.argv[2];
const seasonId = String(process.argv[3] || "20252026");

if (!bundleId) {
  console.error("Usage: node scripts/diagnoseTpBundlePoints.js <bundleId> [seasonId]");
  process.exit(1);
}

const bundleSnap = await db.doc(`team_prediction_bundles/${bundleId}`).get();
if (!bundleSnap.exists) {
  console.error("Bundle not found:", bundleId);
  process.exit(1);
}

const bundle = bundleSnap.data() || {};
const groupId = String(bundle.groupId || "");

const entriesSnap = await db.collection(`team_prediction_bundles/${bundleId}/entries`).get();

console.log("Bundle:", {
  id: bundleId,
  groupId,
  gameYmd: bundle.gameYmd,
  status: bundle.status,
});

for (const doc of entriesSnap.docs) {
  const entry = doc.data() || {};
  const pickResults = entry.pickResults || {};
  const pointsFromResults = Object.values(pickResults).reduce(
    (sum, r) => sum + Number(r?.points || 0),
    0
  );

  const memberSnap = await db
    .doc(`groups/${groupId}/leaderboards/${seasonId}/members/${doc.id}`)
    .get();

  const member = memberSnap.exists ? memberSnap.data() : null;

  console.log(
    JSON.stringify(
      {
        uid: doc.id,
        displayName: entry.displayName || null,
        totalPoints: entry.totalPoints ?? null,
        pointsFromPickResults: pointsFromResults,
        pickResultsCount: Object.keys(pickResults).length,
        leaderboardPointsTotal: member?.pointsTotal ?? null,
        leaderboardTpPoints: member?.tpPoints ?? null,
      },
      null,
      2
    )
  );
}
