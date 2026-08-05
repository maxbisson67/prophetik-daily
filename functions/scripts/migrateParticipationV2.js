/**
 * Backfill group_memberships.participation = "active" for active memberships.
 *
 * Usage (depuis functions/) :
 *   node scripts/migrateParticipationV2.js --dry-run
 *   node scripts/migrateParticipationV2.js
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isActiveMembership } from "../groups/groupMembership.js";
import { PARTICIPATION } from "../groups/participationUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { dryRun: false, batchSize: 400 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") out.dryRun = true;
    if (token === "--batch" && argv[i + 1]) {
      out.batchSize = Number(argv[i + 1]) || 400;
      i += 1;
    }
  }
  return out;
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../jerseys/capitaine-firebase-adminsdk-fbsvc-0581e0ee25.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Service account introuvable.");
}

const args = parseArgs(process.argv.slice(2));
const saPath = resolveServiceAccountPath();

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(saPath) });
}

const db = admin.firestore();

async function migrate() {
  const snap = await db.collection("group_memberships").get();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    scanned += 1;
    const data = docSnap.data() || {};
    if (!isActiveMembership(data)) {
      skipped += 1;
      continue;
    }

    const existing = String(data.participation || "").toLowerCase();
    if (
      existing === PARTICIPATION.ACTIVE ||
      existing === PARTICIPATION.INACTIVE ||
      existing === PARTICIPATION.ADMIN_ONLY
    ) {
      skipped += 1;
      continue;
    }

    if (!args.dryRun) {
      batch.set(
        docSnap.ref,
        {
          participation: PARTICIPATION.ACTIVE,
          participationChangedAt: admin.firestore.FieldValue.serverTimestamp(),
          participationChangedReason: "migration_v2",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      batchCount += 1;
    }
    updated += 1;

    if (!args.dryRun && batchCount >= args.batchSize) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (!args.dryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log("migrateParticipationV2 complete", {
    dryRun: args.dryRun,
    scanned,
    updated,
    skipped,
  });
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
