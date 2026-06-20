import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { resolveTeamPredictionBundles } from "./resolveTeamPredictionBundleCore.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";

export const resolveTeamPredictionBundleResults = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/Toronto",
    region: REGION,
  },
  async () => {
    logger.info("[TP bundle resolve] tick");

    const result = await resolveTeamPredictionBundles({ db });

    logger.info("[TP bundle resolve] done", {
      processed: result.processed ?? 0,
      changedCount: result.changedCount ?? 0,
    });
  }
);
