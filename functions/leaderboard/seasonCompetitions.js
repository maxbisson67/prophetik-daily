import { getFirestore } from "firebase-admin/firestore";
import { getMlbCurrentSeason } from "../players/seasonHelpers.js";
import {
  deriveMlbCompetitionEntries,
  deriveNhlCompetitionEntries,
  isCompetitionOpenForCredit,
  isCompetitionReadyToFinalize,
  normalizeCompetitionEntry,
  normalizeSport,
  pickCompetitionForDate,
} from "./seasonCompetitionCore.js";

const CATALOG_COLLECTION = "seasonCompetitions";
const CURRENT_SEASON_DOC = "app_config/currentSeason";

let cachedCatalog = null;
let cachedCatalogAt = 0;
const CACHE_MS = 60_000;

export async function loadCompetitionCatalog(db = getFirestore()) {
  const now = Date.now();
  if (cachedCatalog && now - cachedCatalogAt < CACHE_MS) {
    return cachedCatalog;
  }

  const entries = [];
  try {
    const snap = await db.collection(CATALOG_COLLECTION).get();
    snap.forEach((doc) => {
      const row = normalizeCompetitionEntry(doc.data(), doc.id);
      if (row?.competitionKey) entries.push(row);
    });
  } catch {
    // optional collection
  }

  cachedCatalog = entries;
  cachedCatalogAt = now;
  return entries;
}

export function invalidateCompetitionCatalogCache() {
  cachedCatalog = null;
  cachedCatalogAt = 0;
}

function catalogForSport(catalog, sport) {
  const s = normalizeSport(sport);
  return (catalog || []).filter((e) => e.sport === s);
}

async function fallbackEntriesForSport(db, sport, gameYmd) {
  const s = normalizeSport(sport);

  if (s === "nhl") {
    try {
      const snap = await db.doc(CURRENT_SEASON_DOC).get();
      if (snap.exists) {
        return deriveNhlCompetitionEntries(snap.data() || {});
      }
    } catch {
      // ignore
    }
    return deriveNhlCompetitionEntries({});
  }

  const seasonId = getMlbCurrentSeason(new Date(`${String(gameYmd || "").slice(0, 10)}T12:00:00Z`));
  return deriveMlbCompetitionEntries(seasonId);
}

export async function resolveCompetition({
  db = getFirestore(),
  sport = "NHL",
  gameYmd,
} = {}) {
  const ymd = String(gameYmd || "").slice(0, 10);
  const catalog = await loadCompetitionCatalog(db);
  const sportEntries = catalogForSport(catalog, sport);

  let picked = pickCompetitionForDate(sportEntries, ymd);
  if (!picked) {
    const fallback = await fallbackEntriesForSport(db, sport, ymd);
    picked = pickCompetitionForDate(fallback, ymd);
  }

  if (!picked) {
    return null;
  }

  return {
    ...picked,
    seasonId: picked.seasonId,
    competitionKey: picked.competitionKey,
    phase: picked.phase,
    fromYmd: picked.fromYmd,
    toYmd: picked.toYmd,
    label: picked.label,
    sport: picked.sport,
  };
}

export async function resolveCompetitionForGroup({
  db = getFirestore(),
  groupId,
  gameYmd,
} = {}) {
  const gid = String(groupId || "").trim();
  if (!gid) return null;

  let sport = "NHL";
  try {
    const gSnap = await db.doc(`groups/${gid}`).get();
    sport = String(gSnap.data()?.sport || "NHL");
  } catch {
    // default NHL
  }

  return resolveCompetition({ db, sport, gameYmd });
}

export async function resolveCompetitionForCredit({
  db = getFirestore(),
  sport = "NHL",
  gameYmd,
} = {}) {
  const comp = await resolveCompetition({ db, sport, gameYmd });
  if (!isCompetitionOpenForCredit(comp, gameYmd)) {
    return null;
  }
  return comp;
}

export async function resolveCompetitionForGroupCredit({
  db = getFirestore(),
  groupId,
  gameYmd,
} = {}) {
  const gid = String(groupId || "").trim();
  if (!gid) return null;

  let sport = "NHL";
  try {
    const gSnap = await db.doc(`groups/${gid}`).get();
    sport = String(gSnap.data()?.sport || "NHL");
  } catch {
    // default NHL
  }

  return resolveCompetitionForCredit({ db, sport, gameYmd });
}

export async function listCompetitionsReadyToFinalize({
  db = getFirestore(),
  todayYmd,
  graceDays = 2,
} = {}) {
  const catalog = await loadCompetitionCatalog(db);
  return catalog.filter((entry) =>
    isCompetitionReadyToFinalize(entry, todayYmd, graceDays)
  );
}

export async function getActiveCompetitionConfig(db = getFirestore(), sport = "NHL", gameYmd) {
  return resolveCompetition({ db, sport, gameYmd });
}
