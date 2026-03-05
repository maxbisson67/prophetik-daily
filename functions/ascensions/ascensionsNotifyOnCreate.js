// functions/ascensions/ascensionsNotifyOnCreate.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

import { APP_TZ, appYmd } from "../ProphetikDate.js";
import { sendPushToGroup } from "../utils/pushUtils.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

/**
 * Notifie quand un défi ASC7 "du jour" existe (open/live) et n'a pas encore été notifié.
 * ✅ Idempotent anti-spam via "claim" transactionnel sur notifiedCreatedAt
 * ✅ Simplification: ASC7 seulement
 *
 * Horaire: chaque heure à :05
 */
export const ascensionsNotifyOnCreate = onSchedule(
  {
    schedule: "5 * * * *",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const today = appYmd(new Date());

    let snap;
    try {
      snap = await db
        .collection("defis")
        .where("gameDate", "==", today)
        .where("status", "in", ["open", "live"])
        .get();
    } catch (e) {
      logger.warn("[ascNotifyOnCreate] query failed", { err: String(e?.message || e) });
      return;
    }

    if (snap.empty) {
      logger.info("[ascNotifyOnCreate] no defis today", { today });
      return;
    }

    const candidates = snap.docs
      .map((d) => ({ ref: d.ref, id: d.id, ...(d.data() || {}) }))
      .filter((d) => String(d.ascension?.key || "").toUpperCase() === "ASC7");

    if (!candidates.length) {
      logger.info("[ascNotifyOnCreate] no ASC7 defis today", { today });
      return;
    }

    let notified = 0;
    let skipped = 0;

    for (const defi of candidates) {
      const defiId = defi.id;
      const groupId = String(defi.groupId || "");
      if (!groupId) {
        skipped++;
        continue;
      }

      // ✅ Claim anti-spam (idempotent + safe si plusieurs schedulers/instances)
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(defi.ref);
        if (!fresh.exists) return false;

        const cur = fresh.data() || {};
        if (cur.notifiedCreatedAt) return false;

        tx.set(defi.ref, { notifiedCreatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return true;
      });

      if (!claimed) {
        skipped++;
        continue;
      }

      const stepType = Number(defi.ascension?.stepType ?? defi.type ?? 0);
      const verb = stepType > 0 ? `${stepType}x${stepType}` : "du jour";

      const title = `Ascension 7 — Défi ${verb}`;
      const body = `Nouveau défi Ascension ${verb} disponible aujourd’hui.`;

      const data = {
        action: "OPEN_DEFI",
        defiId: String(defiId),
        groupId: String(groupId),
      };

      try {
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
        notified++;
      } catch (e) {
        // MVP: on ne “dé-claim” pas pour éviter de spammer en boucle
        logger.warn("[ascNotifyOnCreate] push failed", { defiId, err: String(e?.message || e) });
      }
    }

    logger.info("[ascNotifyOnCreate] done", {
      today,
      scanned: candidates.length,
      notified,
      skipped,
    });
  }
);