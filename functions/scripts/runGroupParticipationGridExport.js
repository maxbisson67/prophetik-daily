/**
 * Export grille participation (tous groupes depuis une date) — CSV Excel + PDF
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/admin.json
 *   cd functions
 *
 *   node scripts/runGroupParticipationGridExport.js \
 *     --csv ./out/participation-grid.csv \
 *     --pdf ./out/participation-grid.pdf
 *
 *   COHORT_START_YMD=2026-10-04  (défaut: 2026-10-04)
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  writeParticipationGridCsv,
  writeParticipationGridPdf,
} from "../reports/groupParticipationGridReport.js";

if (!getApps().length) {
  initializeApp();
}

getFirestore();

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const csvPath = argValue("--csv") || process.env.GRID_CSV_OUT || null;
const pdfPath = argValue("--pdf") || process.env.GRID_PDF_OUT || null;
const cohortStartYmd = process.env.COHORT_START_YMD || "2026-10-04";

async function main() {
  if (!csvPath && !pdfPath) {
    console.error("Provide --csv path and/or --pdf path");
    process.exit(1);
  }

  const opts = { cohortStartYmd };
  const result = { ok: true, cohortStartYmd };

  if (csvPath) {
    result.csv = await writeParticipationGridCsv(csvPath, opts);
  }
  if (pdfPath) {
    result.pdf = await writeParticipationGridPdf(pdfPath, opts);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
