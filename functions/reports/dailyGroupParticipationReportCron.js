import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "../utils.js";
import { FUNCTIONS_REGION } from "../regions.js";
import { runGroupParticipationReport } from "./groupParticipationReportCore.js";

const GROUP_REPORT_SHEET_ID = defineString("GROUP_REPORT_SHEET_ID", {
  default: "",
  description: "Google Spreadsheet ID for daily group participation report",
});

const GROUP_REPORT_SHEETS_SA_JSON = defineSecret("GROUP_REPORT_SHEETS_SA_JSON");

export const dailyGroupParticipationReportCron = onSchedule(
  {
    schedule: "15 7 * * *",
    timeZone: "America/Toronto",
    region: FUNCTIONS_REGION,
    secrets: [GROUP_REPORT_SHEETS_SA_JSON],
  },
  async () => {
    const sheetId = GROUP_REPORT_SHEET_ID.value().trim();
    const serviceAccountJson = GROUP_REPORT_SHEETS_SA_JSON.value();

    if (!sheetId) {
      logger.warn("[groupParticipationReport] skipped — GROUP_REPORT_SHEET_ID not set");
      return;
    }

    if (!serviceAccountJson) {
      logger.warn("[groupParticipationReport] skipped — GROUP_REPORT_SHEETS_SA_JSON not set");
      return;
    }

    await runGroupParticipationReport({
      sheetId,
      serviceAccountJson,
      dryRun: false,
    });
  }
);
