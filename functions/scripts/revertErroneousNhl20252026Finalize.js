/**
 * Annule la finalisation accidentelle (cron) des compétitions catalogue
 * nhl_20252026_{opening,winter,sprint} — repassées « retired », winners effacés.
 *
 *   node functions/scripts/revertErroneousNhl20252026Finalize.js --dry-run
 *   node functions/scripts/revertErroneousNhl20252026Finalize.js --execute
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CATALOG_KEYS = [
  "nhl_20252026_opening",
  "nhl_20252026_winter",
  "nhl_20252026_sprint",
];

const LEADERBOARD_KEYS = CATALOG_KEYS;

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

async function main() {
  const dryRun = !hasFlag("execute");
  initAdmin();
  const db = getFirestore();

  const catalogUpdates = [];
  for (const key of CATALOG_KEYS) {
    const ref = db.doc(`seasonCompetitions/${key}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    catalogUpdates.push({ key, before: snap.data()?.status });
    if (!dryRun) {
      await ref.set(
        {
          status: "retired",
          retiredReason: "superseded_by_20262027_catalog",
          erroneousFinalizeRevertedAt: FieldValue.serverTimestamp(),
          finalizedAt: FieldValue.delete(),
          finalizedOnYmd: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  const groupsSnap = await db.collection("groups").get();
  let metaCleared = 0;
  let metaSkipped = 0;

  for (const groupDoc of groupsSnap.docs) {
    const sport = String(groupDoc.data()?.sport || "").toLowerCase();
    if (sport !== "nhl") continue;

    for (const compKey of LEADERBOARD_KEYS) {
      const ref = db.doc(`groups/${groupDoc.id}/leaderboards/${compKey}`);
      const snap = await ref.get();
      if (!snap.exists) {
        metaSkipped += 1;
        continue;
      }
      const data = snap.data() || {};
      if (!data.winnerDeclaredAt && !data.winnerUids?.length) {
        metaSkipped += 1;
        continue;
      }

      metaCleared += 1;
      if (!dryRun) {
        await ref.set(
          {
            status: "retired",
            winnerUids: FieldValue.delete(),
            winnerPoints: FieldValue.delete(),
            winnerDeclaredAt: FieldValue.delete(),
            erroneousFinalizeRevertedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        catalogUpdates,
        metaCleared,
        metaSkipped,
        groupsScanned: groupsSnap.size,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
