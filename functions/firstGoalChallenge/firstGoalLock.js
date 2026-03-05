// functions/firstGoalLock.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";

const REGION = "us-central1";
const LOCK_BEFORE_MINUTES = 5;

export const lockFirstGoalChallenges = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Toronto",
    region: REGION,
  },
  async () => {
    const now = new Date();
    const lockBeforeMs = LOCK_BEFORE_MINUTES * 60 * 1000;

    logger.info("[FirstGoalLock] Tick", { now: now.toISOString() });

    const snap = await db
      .collection("first_goal_challenges")
      .where("status", "==", "open")
      .where("gameStartTimeUTC", "!=", null)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    let lockedCount = 0;

    snap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const start = data.gameStartTimeUTC?.toDate?.();
      if (!start) return;

      const lockAt = new Date(start.getTime() - lockBeforeMs);

      // lock seulement si encore open (double safe)
      if (String(data.status) !== "open") return;

      if (now >= lockAt) {
        batch.update(doc.ref, {
          status: "locked",
          lockedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        lockedCount++;
      }
    });

    if (lockedCount > 0) {
      await batch.commit();
      logger.info("[FirstGoalLock] Challenges locked", { lockedCount });
    }
  }
);