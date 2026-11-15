/**
 * Réaligne le catalogue 4 compétitions sur la saison NHL 2026-27 (dates 2026/2027).
 * Copie les classements pilotes opening 20252026 → 20262027.
 *
 *   node scripts/realignSeasonCompetitions20262027.js --dry-run
 *   node scripts/realignSeasonCompetitions20262027.js --execute
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 400;
const SEASON_ID = "20262027";

const PILOT_GROUP_IDS = [
  "ovkcdDpAAKRwWSQQFUh7",
  "LcfHpQemisD0JXy5scuo",
  "PKe3Nz5Nu3UtwxuCANpm",
  "VmbZYoAMM9nRkgBBvQUE",
];

const OLD_OPENING = "nhl_20252026_opening";
const NEW_OPENING = "nhl_20262027_opening";

const NHL_FOUR = [
  {
    competitionKey: "nhl_20262027_opening",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "opening",
    label: "Saison NHL 2026-27 — Ouverture",
    fromYmd: "2026-10-07",
    toYmd: "2026-11-25",
    status: "active",
  },
  {
    competitionKey: "nhl_20262027_winter",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "winter",
    label: "Saison NHL 2026-27 — Hiver",
    fromYmd: "2026-11-27",
    toYmd: "2027-02-03",
    status: "active",
  },
  {
    competitionKey: "nhl_20262027_sprint",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "sprint",
    label: "Saison NHL 2026-27 — Sprint",
    fromYmd: "2027-02-08",
    toYmd: "2027-04-10",
    status: "active",
  },
  {
    competitionKey: "nhl_20262027_playoffs",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "playoffs",
    label: "Saison NHL 2026-27 — Séries",
    fromYmd: "2027-04-11",
    toYmd: "2027-06-30",
    status: "active",
  },
];

const RETIRE_KEYS = [
  "nhl_20252026_opening",
  "nhl_20252026_winter",
  "nhl_20252026_sprint",
  "nhl_20252026_playoffs",
];

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function initAdmin() {
  if (getApps().length) return;
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../capitaine-firebase-adminsdk-fbsvc-a0066fa0df.json"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      initializeApp({ credential: cert(JSON.parse(fs.readFileSync(c, "utf8"))) });
      return;
    }
  }
  initializeApp();
}

async function copyOpeningGroup(db, groupId, dryRun) {
  const src = await db.collection(`groups/${groupId}/leaderboards/${OLD_OPENING}/members`).get();
  if (src.empty) {
    return { groupId, skipped: true, reason: "no-old-opening" };
  }
  const sum = src.docs.reduce((a, d) => a + (Number(d.data()?.pointsTotal ?? 0) || 0), 0);
  if (dryRun) {
    return { groupId, dryRun: true, members: src.size, pointsSum: sum };
  }

  for (let i = 0; i < src.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of src.docs.slice(i, i + BATCH_SIZE)) {
      const data = { ...(doc.data() || {}) };
      batch.set(
        db.doc(`groups/${groupId}/leaderboards/${NEW_OPENING}/members/${doc.id}`),
        {
          ...data,
          competitionKey: NEW_OPENING,
          copiedFrom: OLD_OPENING,
          copiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  const metaSnap = await db.doc(`groups/${groupId}/leaderboards/${OLD_OPENING}`).get();
  const opening = NHL_FOUR[0];
  await db.doc(`groups/${groupId}/leaderboards/${NEW_OPENING}`).set(
    {
      ...(metaSnap.data() || {}),
      competitionKey: NEW_OPENING,
      seasonId: NEW_OPENING,
      groupId,
      fromYmd: opening.fromYmd,
      toYmd: opening.toYmd,
      label: opening.label,
      membersCount: src.size,
      copiedFrom: OLD_OPENING,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { groupId, members: src.size, pointsSum: sum };
}

async function main() {
  const dryRun = !hasFlag("execute");
  initAdmin();
  const db = getFirestore();

  const copies = [];
  for (const gid of PILOT_GROUP_IDS) {
    copies.push(await copyOpeningGroup(db, gid, dryRun));
  }

  let catalog = null;
  if (!dryRun) {
    const batch = db.batch();
    for (const entry of NHL_FOUR) {
      batch.set(
        db.doc(`seasonCompetitions/${entry.competitionKey}`),
        { ...entry, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    for (const key of RETIRE_KEYS) {
      batch.set(
        db.doc(`seasonCompetitions/${key}`),
        {
          status: "retired",
          retiredReason: "superseded_by_20262027_catalog",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
    catalog = NHL_FOUR.map((e) => e.competitionKey);
  }

  console.log(JSON.stringify({ ok: true, dryRun, copies, catalog }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
