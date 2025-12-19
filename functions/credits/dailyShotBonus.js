// functions/dailyShotBonus.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";
import { APP_TZ, toYmdInTz, addDaysToYmd } from "../ProphetikDate.js";
import { grantCreditsTx } from "./credits/grantCredits.js"; // ajuste le path si besoin

const MONTHLY_CAP_DEFAULT = 10;

function periodKeyYYYYMM(date = new Date()) {
  const ymd = toYmdInTz(date, APP_TZ);
  return ymd.slice(0, 7).replace("-", "");
}

function nextMonthStartYmd(now = new Date()) {
  const ymd = toYmdInTz(now, APP_TZ);
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}-01`;
}

export const dailyShotBonus = onCall(
  { region: "us-central1", cors: true },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

    const now = new Date();
    const todayYmd = toYmdInTz(now, APP_TZ);
    const periodKey = periodKeyYYYYMM(now);

    const monthlyCapRaw = req.data?.monthlyCap;
    const monthlyCap =
      Number.isFinite(Number(monthlyCapRaw)) && Number(monthlyCapRaw) > 0
        ? Number(monthlyCapRaw)
        : MONTHLY_CAP_DEFAULT;

    const pRef = db.doc(`participants/${uid}`);
    const quotaRef = pRef.collection("system").doc(`daily_shot_${periodKey}`);

    const result = await db.runTransaction(async (tx) => {
      const qSnap = await tx.get(quotaRef);
      const q = qSnap.exists ? qSnap.data() || {} : {};

      const lastDay = String(q.lastDay || "");
      const granted = Number(q.creditsGranted || 0);

      if (lastDay === todayYmd) {
        throw new HttpsError("failed-precondition", "ALREADY_TAKEN_TODAY", {
          todayYmd,
          periodKey,
          creditsGranted: granted,
          monthlyCap,
          nextAvailableDay: addDaysToYmd(todayYmd, 1),
        });
      }

      if (granted >= monthlyCap) {
        throw new HttpsError("failed-precondition", "MONTHLY_CAP_REACHED", {
          todayYmd,
          periodKey,
          creditsGranted: granted,
          monthlyCap,
          nextAvailableDay: nextMonthStartYmd(now),
        });
      }

      // ✅ 1 crédit, idempotent par jour
      const amount = 1;
      const grantId = `dailyshot_${uid}_${todayYmd}`;

      const r = await grantCreditsTx(tx, {
        uid,
        amount,
        grantId,
        source: "CREDIT_DAILY_SHOT", // ✅ match UI + CREDIT_SOURCES
        meta: { periodKey, day: todayYmd },
      });

      // si retry => déjà accordé, on ne bump pas quota 2x
      if (r.applied !== true) {
        return {
          ok: true,
          applied: false,
          reason: r.reason || "already_granted",
          amount: 0,
          periodKey,
          todayYmd,
          creditsGranted: granted,
          monthlyCap,
          nextAvailableDay: addDaysToYmd(todayYmd, 1),
        };
      }

      // ✅ quota du mois
      tx.set(
        quotaRef,
        {
          periodKey,
          monthlyCap,
          creditsGranted: granted + 1,
          lastDay: todayYmd,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        ok: true,
        applied: true,
        amount,
        grantId,
        periodKey,
        todayYmd,
        creditsGranted: granted + 1,
        monthlyCap,
        nextAvailableDay: addDaysToYmd(todayYmd, 1),
        fromBalance: r.fromBalance ?? null,
        toBalance: r.toBalance ?? null,
      };
    });

    logger.info("dailyShotBonus", { uid, ...result });
    return result;
  }
);