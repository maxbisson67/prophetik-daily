// functions/subscriptions.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import admin from "firebase-admin";

// ✅ Source de vérité dates/fuseau
import { APP_TZ, addDays, toYmdInTz } from "./ProphetikDate.js";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* =========================================================
   Helpers
========================================================= */

function periodKeyYYYYMM(date = new Date()) {
  const ymd = toYmdInTz(date, APP_TZ); // "YYYY-MM-DD"
  return ymd.slice(0, 7).replace("-", ""); // "YYYYMM"
}

/* =========================================================
   Core: process ONE entitlement
========================================================= */
async function processOneEntitlement(entRef, nowDate) {
  const uid = entRef.id;

  await db.runTransaction(async (tx) => {
    const entSnap = await tx.get(entRef);
    if (!entSnap.exists) return;

    const ent = entSnap.data() || {};

    if (ent.uid && ent.uid !== uid) {
      logger.warn("Entitlement uid mismatch", { uid, entUid: ent.uid });
    }

    if (ent.status !== "active") return;
    if (ent.autoGrant !== true) return;

    const nextGrantAt = ent.nextGrantAt?.toDate?.() || null;
    if (!nextGrantAt || nextGrantAt > nowDate) return;

    const planKey = String(ent.planKey || "free");
    const monthlyCredits = Number(ent.monthlyCredits || 0);
    if (!Number.isFinite(monthlyCredits) || monthlyCredits <= 0) return;

    const capRaw = Number(ent.freeCap || 0);
    const freeCap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : 20;

    const periodKey = periodKeyYYYYMM(nowDate);
    const grantId = `${uid}_${periodKey}_${planKey}`;
    const grantRef = db.doc(`credit_grants/${grantId}`);

    // Idempotence
    const existingGrant = await tx.get(grantRef);
    if (existingGrant.exists) return;

    // Lire participant (credits.balance)
    const pRef = db.doc(`participants/${uid}`);
    const pSnap = await tx.get(pRef);

    const prevBalance = Number(pSnap.data()?.credits?.balance || 0);

    // Calcul du montant à ajouter
    let amountToAdd = monthlyCredits;

    if (planKey === "free") {
      const room = Math.max(0, freeCap - prevBalance);
      amountToAdd = Math.min(monthlyCredits, room);
    }

    const nowTs = admin.firestore.FieldValue.serverTimestamp();

    // Écrire le grant (même si 0)
    tx.set(grantRef, {
      uid,
      planKey,
      periodKey,
      amount: amountToAdd,
      computedCap: planKey === "free" ? freeCap : null,
      prevBalance,
      createdAt: nowTs,
    });

    // Appliquer crédits si > 0
    if (amountToAdd > 0) {
      tx.set(
        pRef,
        {
          credits: {
            balance: admin.firestore.FieldValue.increment(amountToAdd),
            updatedAt: nowTs,
          },
          updatedAt: nowTs, // optionnel si tu gardes aussi un updatedAt top-level
        },
        { merge: true }
      );

      const logRef = pRef.collection("credit_logs").doc();
      tx.set(logRef, {
        type: "MONTHLY_GRANT",
        planKey,
        amount: amountToAdd,
        periodKey,
        createdAt: nowTs,
      });
    }

    // Prochain octroi dans 30 jours
    tx.set(
      entRef,
      {
        lastGrantAt: nowTs,
        nextGrantAt: admin.firestore.Timestamp.fromDate(addDays(nowDate, 30)),
        updatedAt: nowTs,
      },
      { merge: true }
    );
  });
}

/* =========================================================
   Scheduled job
========================================================= */
export const grantMonthlyCredits = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const now = new Date();
    logger.info("grantMonthlyCredits tick", {
      now: now.toISOString(),
      tz: APP_TZ,
      periodKey: periodKeyYYYYMM(now),
    });

    const snap = await db
      .collection("entitlements")
      .where("status", "==", "active")
      .where("autoGrant", "==", true)
      .where("nextGrantAt", "<=", admin.firestore.Timestamp.fromDate(now))
      .limit(50)
      .get();

    logger.info("due entitlements", { count: snap.size });

    for (const doc of snap.docs) {
      try {
        await processOneEntitlement(doc.ref, now);
      } catch (e) {
        logger.error("processOneEntitlement failed", {
          uid: doc.id,
          message: e?.message || String(e),
        });
      }
    }
  }
);