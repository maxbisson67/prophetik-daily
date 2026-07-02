import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FUNCTIONS_REGION } from "../regions.js";
import { APP_TZ } from "../ProphetikDate.js";
import { runAutopilotInactivityCheck } from "./autopilotInactivityUtils.js";

/**
 * Vérifie la veille (Toronto) : si aucun participant humain n'a joué aux défis
 * quotidiens, incrémente le streak. À 3 jours consécutifs → autopilot off + push owner.
 *
 * Planifié après la fin de la journée de matchs, avant le cron autopilot du matin.
 */
export const disableInactiveAutopilotCron = onSchedule(
  {
    schedule: "30 2 * * *",
    timeZone: APP_TZ,
    region: FUNCTIONS_REGION,
  },
  async () => {
    await runAutopilotInactivityCheck(new Date());
  }
);

export const disableInactiveAutopilotNow = onCall(
  { region: FUNCTIONS_REGION, timeoutSeconds: 120 },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const stats = await runAutopilotInactivityCheck(new Date());
    return { ok: true, stats };
  }
);
