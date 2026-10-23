import { logger } from "firebase-functions";
import { appYmd } from "../ProphetikDate.js";
import { isWithinLiveCronSchedule, shouldRunIngestForControls } from "./liveCronGate.js";
import { LIVE_LEAGUES, readLiveControl } from "./liveControl.js";
import { getFirestoreCostFlags } from "./firestoreCostFlags.js";

const ACTIVE_FGC_STATUSES = ["open", "locked", "live"];
const ACTIVE_DEFI_STATUSES = ["open", "live", "awaiting_result"];

/**
 * Hors fenêtre live : évite les scans Firestore des crons 1 min si tout est idle.
 * @returns {Promise<boolean>} true = skip ce tick
 */
export async function shouldSkipIdleCronTick(db, tag = "cron") {
  const { cronIdleGate } = getFirestoreCostFlags();
  if (!cronIdleGate) return false;
  if (isWithinLiveCronSchedule()) return false;

  const ymd = appYmd(new Date());
  const [nhlControl, mlbControl] = await Promise.all([
    readLiveControl(LIVE_LEAGUES.NHL, ymd),
    readLiveControl(LIVE_LEAGUES.MLB, ymd),
  ]);

  if (shouldRunIngestForControls({ nhlControl, mlbControl })) return false;

  const [fgcSnap, defiSnap, rbiSnap] = await Promise.all([
    db
      .collection("first_goal_challenges")
      .where("status", "in", ACTIVE_FGC_STATUSES)
      .limit(1)
      .get(),
    db.collection("defis").where("status", "in", ACTIVE_DEFI_STATUSES).limit(1).get(),
    db
      .collection("mlb_first_rbi_games")
      .where("status", "in", ["pending", "provisional"])
      .limit(1)
      .get()
      .catch(() => ({ empty: true })),
  ]);

  if (!fgcSnap.empty || !defiSnap.empty || !rbiSnap.empty) return false;

  logger.info(`[${tag}] skipped_idle`, {
    reason: "idle_gate",
    ymd,
    nhlMode: nhlControl?.mode || "idle",
    mlbMode: mlbControl?.mode || "idle",
  });
  return true;
}
