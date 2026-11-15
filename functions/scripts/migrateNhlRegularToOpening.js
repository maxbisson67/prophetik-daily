/**
 * Copie le classement nhl_20252026_regular → nhl_20252026_opening (compétition 1).
 * À exécuter AVANT d'écrire le catalogue seasonCompetitions (sinon les crédits se split).
 *
 * Usage (depuis functions/) :
 *   node scripts/migrateNhlRegularToOpening.js --dry-run
 *   node scripts/migrateNhlRegularToOpening.js --groupIds=gid1,gid2 --dry-run
 *   node scripts/migrateNhlRegularToOpening.js --pilot-groups --dry-run
 *   node scripts/migrateNhlRegularToOpening.js --all-nhl-groups --execute
 *   node scripts/migrateNhlRegularToOpening.js --pilot-groups --execute --seed-catalog
 *
 * --seed-catalog : écrit les 4 docs seasonCompetitions (avec --execute seulement).
 *
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS, scripts/serviceAccountKey.json,
 *   ou ../capitaine-firebase-adminsdk-*.json à la racine du projet.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 400;

const SOURCE_KEY = "nhl_20252026_regular";
const TARGET_KEY = "nhl_20252026_opening";
const SEASON_ID = "20252026";

const PILOT_GROUP_IDS = [
  "ovkcdDpAAKRwWSQQFUh7",
  "LcfHpQemisD0JXy5scuo",
  "PKe3Nz5Nu3UtwxuCANpm",
  "VmbZYoAMM9nRkgBBvQUE",
];

/** Fenêtres figées produit (Toronto) — playoffs = placeholder, ajuster avant clôture. */
export const NHL_FOUR_COMPETITIONS = [
  {
    competitionKey: "nhl_20252026_opening",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "opening",
    label: "Saison NHL 2025-26 — Ouverture",
    fromYmd: "2025-10-07",
    toYmd: "2025-11-25",
    status: "active",
  },
  {
    competitionKey: "nhl_20252026_winter",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "winter",
    label: "Saison NHL 2025-26 — Hiver",
    fromYmd: "2025-11-27",
    toYmd: "2026-02-03",
    status: "active",
  },
  {
    competitionKey: "nhl_20252026_sprint",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "sprint",
    label: "Saison NHL 2025-26 — Sprint",
    fromYmd: "2026-02-08",
    toYmd: "2026-04-10",
    status: "active",
  },
  {
    competitionKey: "nhl_20252026_playoffs",
    sport: "nhl",
    seasonId: SEASON_ID,
    phase: "playoffs",
    label: "Saison NHL 2025-26 — Séries",
    fromYmd: "2026-04-11",
    toYmd: "2026-06-30",
    status: "active",
  },
];

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../../capitaine-firebase-adminsdk-fbsvc-a0066fa0df.json"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function initAdmin() {
  if (getApps().length) return;
  const saPath = resolveServiceAccountPath();
  if (saPath) {
    initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
    });
    return;
  }
  initializeApp();
}

function isActiveGroup(data = {}) {
  const status = String(data?.status || "").toLowerCase();
  if (data?.active === false) return false;
  if (status === "archived" || status === "deleted") return false;
  return true;
}

function isNhlGroup(data = {}) {
  const sport = String(data?.sport || data?.league || "NHL").toUpperCase();
  return sport === "NHL";
}

function memberPreview(doc) {
  const x = doc.data() || {};
  return {
    uid: doc.id,
    pointsTotal: Number(x.pointsTotal ?? 0) || 0,
    participations: Number(x.participations ?? 0) || 0,
  };
}

function sumPoints(docs) {
  return docs.reduce((acc, d) => acc + (Number(d.data()?.pointsTotal ?? 0) || 0), 0);
}

async function listTargetGroupIds(db, { groupIds, allNhl, pilotGroups }) {
  if (groupIds.length) return groupIds;

  if (pilotGroups) return [...PILOT_GROUP_IDS];

  if (!allNhl) return [];

  const snap = await db.collection("groups").get();
  return snap.docs
    .filter((d) => isActiveGroup(d.data()) && isNhlGroup(d.data()))
    .map((d) => d.id);
}

async function migrateOneGroup(db, groupId, { dryRun }) {
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) {
    return { ok: false, groupId, reason: "group-not-found" };
  }

  const group = groupSnap.data() || {};
  const membersRef = db.collection(
    `groups/${groupId}/leaderboards/${SOURCE_KEY}/members`
  );
  const sourceSnap = await membersRef.get();

  if (sourceSnap.empty) {
    return {
      ok: true,
      groupId,
      groupName: group.name || group.title || null,
      skipped: true,
      reason: "no-source-members",
      membersCount: 0,
    };
  }

  const targetRef = db.collection(
    `groups/${groupId}/leaderboards/${TARGET_KEY}/members`
  );
  const targetSnap = await targetRef.get();

  const sourceTotal = sumPoints(sourceSnap.docs);
  const targetTotal = sumPoints(targetSnap.docs);

  const topSource = sourceSnap.docs
    .map(memberPreview)
    .sort((a, b) => b.pointsTotal - a.pointsTotal)
    .slice(0, 5);

  const conflicts = [];
  for (const sDoc of sourceSnap.docs) {
    const tDoc = targetSnap.docs.find((d) => d.id === sDoc.id);
    if (!tDoc) continue;
    const sp = Number(sDoc.data()?.pointsTotal ?? 0) || 0;
    const tp = Number(tDoc.data()?.pointsTotal ?? 0) || 0;
    if (sp !== tp) {
      conflicts.push({ uid: sDoc.id, sourcePoints: sp, targetPoints: tp });
    }
  }

  const report = {
    ok: true,
    dryRun,
    groupId,
    groupName: group.name || group.title || null,
    sourceKey: SOURCE_KEY,
    targetKey: TARGET_KEY,
    membersToCopy: sourceSnap.size,
    targetExistingMembers: targetSnap.size,
    sourcePointsSum: sourceTotal,
    targetPointsSumBefore: targetTotal,
    conflicts: conflicts.slice(0, 20),
    conflictsCount: conflicts.length,
    topSource,
  };

  if (dryRun) return report;

  const openingEntry = NHL_FOUR_COMPETITIONS[0];

  for (let i = 0; i < sourceSnap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = sourceSnap.docs.slice(i, i + BATCH_SIZE);
    for (const sDoc of slice) {
      const data = { ...(sDoc.data() || {}) };
      delete data.winnerDeclaredAt;
      const dest = targetRef.doc(sDoc.id);
      batch.set(
        dest,
        {
          ...data,
          uid: sDoc.id,
          competitionKey: TARGET_KEY,
          migratedFrom: SOURCE_KEY,
          migratedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  const metaRef = db.doc(`groups/${groupId}/leaderboards/${TARGET_KEY}`);
  const sourceMetaSnap = await db.doc(`groups/${groupId}/leaderboards/${SOURCE_KEY}`).get();
  const sourceMeta = sourceMetaSnap.data() || {};

  await metaRef.set(
    {
      ...sourceMeta,
      seasonId: TARGET_KEY,
      competitionKey: TARGET_KEY,
      groupId,
      fromYmd: openingEntry.fromYmd,
      toYmd: openingEntry.toYmd,
      label: openingEntry.label,
      membersCount: sourceSnap.size,
      winnerUids: FieldValue.delete(),
      winnerPoints: FieldValue.delete(),
      winnerDeclaredAt: FieldValue.delete(),
      status: "active",
      migratedFrom: SOURCE_KEY,
      migratedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const summarySrc = db.doc(
    `groups/${groupId}/leaderboards/${SOURCE_KEY}/stats/summary`
  );
  const summaryDst = db.doc(
    `groups/${groupId}/leaderboards/${TARGET_KEY}/stats/summary`
  );
  const summarySnap = await summarySrc.get();
  if (summarySnap.exists) {
    const s = summarySnap.data() || {};
    await summaryDst.set(
      {
        ...s,
        seasonId: TARGET_KEY,
        groupId,
        fromYmd: openingEntry.fromYmd,
        toYmd: openingEntry.toYmd,
        migratedFrom: SOURCE_KEY,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const targetAfter = await targetRef.get();
  return {
    ...report,
    dryRun: false,
    targetPointsSumAfter: sumPoints(targetAfter.docs),
    membersCopied: sourceSnap.size,
  };
}

async function seedSeasonCompetitionsCatalog(db) {
  const batch = db.batch();
  for (const entry of NHL_FOUR_COMPETITIONS) {
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
  }
  await batch.commit();
  return NHL_FOUR_COMPETITIONS.map((e) => e.competitionKey);
}

async function main() {
  const dryRun = !hasFlag("execute");
  const allNhl = hasFlag("all-nhl-groups");
  const pilotGroups = hasFlag("pilot-groups");
  const seedCatalog = hasFlag("seed-catalog");
  const rawIds = String(readArg("groupIds") || "").trim();
  const groupIds = rawIds
    ? rawIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!groupIds.length && !allNhl && !pilotGroups) {
    console.error(
      "Specify --pilot-groups, --all-nhl-groups, or --groupIds=id1,id2. Default is dry-run; use --execute to write."
    );
    process.exit(1);
  }

  if (seedCatalog && dryRun) {
    console.error("--seed-catalog requires --execute (run migration execute first).");
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore();

  const targets = await listTargetGroupIds(db, { groupIds, allNhl, pilotGroups });
  if (!targets.length) {
    console.error(JSON.stringify({ ok: false, reason: "no-target-groups" }, null, 2));
    process.exit(1);
  }

  const results = [];
  for (const gid of targets) {
    results.push(await migrateOneGroup(db, gid, { dryRun }));
  }

  let catalogKeys = null;
  if (seedCatalog && !dryRun) {
    catalogKeys = await seedSeasonCompetitionsCatalog(db);
  }

  const summary = {
    ok: true,
    mode: dryRun ? "dry-run" : "execute",
    groups: targets.length,
    migrated: results.filter((r) => r.ok && !r.skipped && (r.membersToCopy || r.membersCopied)),
    skipped: results.filter((r) => r.skipped),
    failed: results.filter((r) => !r.ok),
    seedCatalog: catalogKeys,
    note: dryRun
      ? "Dry-run only. Re-run with --execute (then optional --seed-catalog on same run or after all-nhl execute)."
      : seedCatalog
      ? "Migration + catalogue seasonCompetitions écrits."
      : "Migration done. Run again with --seed-catalog --execute after all groups migrated.",
  };

  console.log(JSON.stringify({ summary, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
