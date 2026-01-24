// functions/ascensions/ascensionsDailyNotification.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

import { APP_TZ, appYmd } from "../ProphetikDate.js";
import { sendPushToGroup } from "../utils/pushUtils.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

export const ascensionsDailyNotification = onSchedule(
  {
    schedule: "55 11 * * *",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const today = appYmd(new Date());

    // Défis du jour open/live
    const snap = await db
      .collection("defis")
      .where("gameDate", "==", today)
      .where("status", "in", ["open", "live"])
      .get();

    if (snap.empty) {
      logger.info("[ascNotify9am] no defis today", { today });
      return;
    }

    const defis = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((d) => !!d.ascension?.key);

    if (!defis.length) {
      logger.info("[ascNotify9am] no ascension defis today", { today });
      return;
    }

    logger.info("[ascNotify9am] ascension defis today", { today, count: defis.length });

    for (const defi of defis) {
      const defiId = defi.id;
      const groupId = String(defi.groupId || "");
      if (!groupId) continue;

      // anti-spam
      if (defi.notified9amAt) {
        logger.info("[ascNotify9am] already notified", { defiId });
        continue;
      }

      const verb = defi.type ? `${defi.type}x${defi.type}` : "du jour";
      const title = `Ascension — Défi ${verb}`;
      const body = `Rappel: le défi ${verb} est disponible aujourd’hui. Poursuit ton Ascension!`;

      const data = {
        action: "OPEN_DEFI",
        defiId: String(defiId),
        groupId: String(groupId),
      };

      const res = await sendPushToGroup({
        groupId,
        includeAi: false,
        title,
        body,
        data,
        channelId: "challenges_v2",
        logTag: "ascNotify9am",
      });

      logger.info("[ascNotify9am] push done", { defiId, ...res });

      await db.doc(`defis/${defiId}`).set(
        { notified9amAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }
);