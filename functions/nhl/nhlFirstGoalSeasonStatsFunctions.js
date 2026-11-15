import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { FUNCTIONS_REGION } from "../regions.js";
import { APP_TZ } from "../ProphetikDate.js";
import {
  runBackfillNhlFirstGoalSeasonStats,
  runDailyNhlFirstGoalSeasonStatsSync,
} from "./nhlFirstGoalSeasonStatsCore.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

export const syncNhlFirstGoalSeasonStatsDaily = onSchedule(
  {
    schedule: "45 3 * * *",
    timeZone: APP_TZ,
    region: FUNCTIONS_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const stats = await runDailyNhlFirstGoalSeasonStatsSync(db);
    logger.info("[syncNhlFirstGoalSeasonStatsDaily] done", stats);
  }
);

export const backfillNhlFirstGoalSeasonStats = onCall(
  {
    region: FUNCTIONS_REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    try {
      const stats = await runBackfillNhlFirstGoalSeasonStats(db, {
        seasonId: req.data?.seasonId,
        fromYmdDashed: req.data?.fromYmd,
        toYmdDashed: req.data?.toYmd,
        maxGames: req.data?.maxGames,
        dryRun: req.data?.dryRun === true,
      });

      return { ok: true, stats };
    } catch (e) {
      logger.error("[backfillNhlFirstGoalSeasonStats]", {
        message: String(e?.message || e),
      });
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);
