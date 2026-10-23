/**
 * Manual run: daily group participation report → Google Sheet
 *
 * Env:
 *   GROUP_REPORT_SHEET_ID
 *   GROUP_REPORT_SHEETS_SA_JSON  (full service account JSON string)
 *
 * Optional:
 *   REPORT_YMD=2026-10-17
 *   DRY_RUN=1
 *   PDF_OUT=./reports/group-participation.pdf
 *
 * Or: node scripts/runGroupParticipationReport.js --pdf ./out/report.pdf
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { runGroupParticipationReport } from "../reports/groupParticipationReportCore.js";

if (!getApps().length) {
  initializeApp();
}

getFirestore();

const dryRun = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
const pdfArgIdx = process.argv.indexOf("--pdf");
const pdfPath =
  (pdfArgIdx >= 0 ? process.argv[pdfArgIdx + 1] : null) ||
  process.env.PDF_OUT ||
  null;
const reportYmd = process.env.REPORT_YMD || null;
const sheetId = String(process.env.GROUP_REPORT_SHEET_ID || "").trim();
const serviceAccountJson = String(process.env.GROUP_REPORT_SHEETS_SA_JSON || "").trim();

async function main() {
  const result = await runGroupParticipationReport({
    reportYmd,
    pdfPath: dryRun ? null : pdfPath,
    sheetId: pdfPath && !dryRun ? null : sheetId,
    serviceAccountJson: pdfPath && !dryRun ? null : serviceAccountJson,
    dryRun,
  });

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
