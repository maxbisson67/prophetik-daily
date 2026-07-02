/**
 * Seed seasonCompetitions from currentSeason (NHL) + defaults MLB.
 *
 * Usage: node functions/scripts/seedSeasonCompetitions.js
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMlbCurrentSeason } from "../players/seasonHelpers.js";
import {
  deriveMlbCompetitionEntries,
  deriveNhlCompetitionEntries,
  defaultMlbSeasonBounds,
} from "../leaderboard/seasonCompetitionCore.js";

async function fetchMlbSeasonBoundsFromApi(seasonYear) {
  const year = String(seasonYear || getMlbCurrentSeason());
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/seasons?season=${encodeURIComponent(year)}&sportId=1`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const seasons = Array.isArray(json?.seasons) ? json.seasons : [];
    const row = seasons.find((s) => String(s?.seasonId) === year) || seasons[0];
    if (!row) return null;

    const regularStart = String(row.regularSeasonStartDate || "").slice(0, 10);
    const regularEnd = String(row.regularSeasonEndDate || "").slice(0, 10);
    const seasonEnd = String(row.seasonEndDate || row.postseasonEndDate || "").slice(0, 10);

    if (!regularStart || !regularEnd) return null;

    const poStart = addDaysToYmd(regularEnd, 1);
    return {
      regular: { fromYmd: regularStart, toYmd: regularEnd },
      playoffs: { fromYmd: poStart, toYmd: seasonEnd || addDaysToYmd(regularEnd, 45) },
    };
  } catch {
    return null;
  }
}

function addDaysToYmd(baseYmd, delta) {
  const m = String(baseYmd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return baseYmd;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

if (!getApps().length) initializeApp();
const db = getFirestore();

async function main() {
  const batch = db.batch();
  let count = 0;

  const currentSnap = await db.doc("app_config/currentSeason").get();
  const nhlConfig = currentSnap.exists ? currentSnap.data() || {} : {};
  const nhlEntries = deriveNhlCompetitionEntries(nhlConfig);

  for (const entry of nhlEntries) {
    const ref = db.doc(`seasonCompetitions/${entry.competitionKey}`);
    batch.set(
      ref,
      {
        ...entry,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    count += 1;
    console.log("NHL:", entry.competitionKey, entry.fromYmd, "→", entry.toYmd);
  }

  const mlbSeasonId = getMlbCurrentSeason(new Date());
  const mlbBounds =
    (await fetchMlbSeasonBoundsFromApi(mlbSeasonId)) || defaultMlbSeasonBounds(mlbSeasonId);
  const mlbEntries = deriveMlbCompetitionEntries(mlbSeasonId, mlbBounds);

  for (const entry of mlbEntries) {
    const ref = db.doc(`seasonCompetitions/${entry.competitionKey}`);
    batch.set(
      ref,
      {
        ...entry,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    count += 1;
    console.log("MLB:", entry.competitionKey, entry.fromYmd, "→", entry.toYmd);
  }

  await batch.commit();
  console.log(`\n✅ ${count} compétitions écrites dans seasonCompetitions`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
