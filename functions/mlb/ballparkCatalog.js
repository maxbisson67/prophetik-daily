/**
 * Lookup catalogue stades MLB (Firestore + seed en mémoire).
 */
import { db, FieldValue } from "../utils.js";
import {
  MLB_BALLPARK_SEED,
  BALLPARK_CATALOG_SOURCE,
  BALLPARK_CATALOG_SEASON,
  ballparkIdFromVenueId,
} from "./ballparkCatalogData.js";

const seedByVenueId = new Map(
  MLB_BALLPARK_SEED.map((row) => [String(row.mlbVenueId), row])
);

export function buildBallparkDocFromSeed(row) {
  const ballparkId = ballparkIdFromVenueId(row.mlbVenueId);
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

export function getSeedBallparkByVenueId(venueId) {
  return seedByVenueId.get(String(venueId ?? "").trim()) || null;
}

export async function loadBallparkFromFirestore(venueId) {
  const ballparkId = ballparkIdFromVenueId(venueId);
  if (!ballparkId) return null;

  const snap = await db.doc(`catalog_ballparks/${ballparkId}`).get();
  if (!snap.exists) return null;
  return { id: ballparkId, ...(snap.data() || {}) };
}

export async function resolveBallparkForVenue(venueId) {
  const fromDb = await loadBallparkFromFirestore(venueId);
  if (fromDb) return fromDb;

  const seed = getSeedBallparkByVenueId(venueId);
  if (!seed) return null;

  return {
    id: ballparkIdFromVenueId(seed.mlbVenueId),
    ...buildBallparkDocFromSeed(seed),
  };
}

export async function loadAllBallparksMap() {
  const snap = await db.collection("catalog_ballparks").get();
  const map = new Map();

  snap.forEach((doc) => {
    const d = doc.data() || {};
    const vid = String(d.mlbVenueId ?? doc.id);
    map.set(vid, { id: doc.id, ...d });
  });

  for (const row of MLB_BALLPARK_SEED) {
    const vid = String(row.mlbVenueId);
    if (!map.has(vid)) {
      map.set(vid, {
        id: ballparkIdFromVenueId(row.mlbVenueId),
        ...buildBallparkDocFromSeed(row),
      });
    }
  }

  return map;
}
