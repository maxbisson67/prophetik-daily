/**
 * Seed catalog_ballparks — 30 parcs MLB.
 *
 * Usage:
 *   node functions/scripts/seedMlbBallparkCatalog.js --dry-run
 *   node functions/scripts/seedMlbBallparkCatalog.js --commit
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  MLB_BALLPARK_SEED,
  BALLPARK_CATALOG_SOURCE,
  BALLPARK_CATALOG_SEASON,
  ballparkIdFromVenueId,
} from "../mlb/ballparkCatalogData.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--commit");

function buildDoc(row) {
  return {
    sport: "MLB",
    mlbVenueId: row.mlbVenueId,
    key: row.key,
    name: row.name,
    city: row.city,
    state: row.state,
    teamId: row.teamId,
    teamAbbreviation: row.teamAbbreviation,
    latitude: row.latitude,
    longitude: row.longitude,
    altitudeMeters: row.altitudeMeters ?? null,
    timezone: row.timezone,
    roofType: row.roofType,
    defaultRoofState: row.defaultRoofState ?? null,
    centerFieldBearingDegrees: row.centerFieldBearingDegrees ?? null,
    parkFactorRuns: row.parkFactorRuns ?? null,
    parkFactorHomeRuns: row.parkFactorHomeRuns ?? null,
    parkFactorHits: row.parkFactorHits ?? null,
    parkFactorDoubles: row.parkFactorDoubles ?? null,
    leftHandedHomeRunFactor: row.leftHandedHomeRunFactor ?? null,
    rightHandedHomeRunFactor: row.rightHandedHomeRunFactor ?? null,
    source: BALLPARK_CATALOG_SOURCE,
    season: BALLPARK_CATALOG_SEASON,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function main() {
  console.log(dryRun ? "[DRY RUN]" : "[COMMIT]", "Seeding catalog_ballparks…");
  console.log("Rows:", MLB_BALLPARK_SEED.length);

  if (dryRun) {
    for (const row of MLB_BALLPARK_SEED) {
      const id = ballparkIdFromVenueId(row.mlbVenueId);
      console.log(`  ${id} — ${row.name} (${row.teamAbbreviation})`);
    }
    console.log("\nRe-run with --commit to write Firestore.");
    return;
  }

  let batch = db.batch();
  let ops = 0;
  let count = 0;

  for (const row of MLB_BALLPARK_SEED) {
    const id = ballparkIdFromVenueId(row.mlbVenueId);
    const ref = db.doc(`catalog_ballparks/${id}`);
    batch.set(ref, { ...buildDoc(row), createdAt: FieldValue.serverTimestamp() }, { merge: true });
    ops += 1;
    count += 1;

    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  console.log(`Done. ${count} ballparks written to catalog_ballparks.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
