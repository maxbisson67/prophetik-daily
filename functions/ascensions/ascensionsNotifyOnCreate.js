import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

import { APP_TZ, appYmd } from "../ProphetikDate.js";
import { sendPushToGroup } from "../utils/pushUtils.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

export const ascensionsNotifyOnCreate = onSchedule(
  {
    schedule: "5 * * * *", // à chaque heure, minute 05 (évite collision pile à 0)
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const today = appYmd(new Date());

    // Défis du jour open/live, ascension seulement
    const snap = await db
      .collection("defis")
      .where("gameDate", "==", today)
      .where("status", "in", ["open", "live"])
      .get();

    if (snap.empty) {
      logger.info("[ascNotifyOnCreate] no defis today", { today });
      return;
    }

    const ascDefis = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((d) => !!d.ascension?.key)
      .filter((d) => !d.notifiedCreatedAt); // anti-spam

    if (!ascDefis.length) {
      logger.info("[ascNotifyOnCreate] no new ascension defis to notify", { today });
      return;
    }

    logger.info("[ascNotifyOnCreate] new ascension defis", { today, count: ascDefis.length });

    for (const defi of ascDefis) {
      const defiId = defi.id;
      const groupId = String(defi.groupId || "");
      if (!groupId) continue;

      const verb = defi.type ? `${defi.type}x${defi.type}` : "du jour";
      const ascKey = String(defi.ascension?.key || "").toUpperCase(); // ASC4/ASC7

      const title = `${ascKey} — Défi ${verb}`;
      const body = `Nouveau défi Ascension ${verb} disponible aujourd’hui.`;

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
        logTag: "ascNotifyOnCreate",
      });

      logger.info("[ascNotifyOnCreate] push done", { defiId, ...res });

      await db.doc(`defis/${defiId}`).set(
        { notifiedCreatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }
);