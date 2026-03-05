// functions/ascensions/applyAscensionDailyBonus.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

import { APP_TZ, toYmdInTz } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const ASC_KEY = "ASC7";

function ymdNowInAppTz(date = new Date()) {
  return toYmdInTz(date, APP_TZ);
}

function dowInTz(date = new Date(), tz = APP_TZ) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

// ✅ Dim..Ven: +2 | Sam: +5
function dailyBonusForAsc7(date = new Date()) {
  const dow = dowInTz(date, APP_TZ);
  return dow === 6 ? 5 : 2;
}

async function listGroupsWithAsc7Enabled() {
  const snap = await db
    .collection("groups")
    .where("questAsc7.enabled", "==", true)
    .get()
    .catch((e) => {
      logger.error("[applyAscensionDailyBonus] list groups query failed", { err: String(e?.message || e) });
      return null;
    });

  if (!snap || snap.empty) return [];
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * applyAscensionDailyBonus (ASC7):
 * - 1x / jour (ex: 05:10)
 * - Pour chaque groupe ASC7 activé:
 *   - lit groups/{gid}/ascensions/ASC7 activeRunId
 *   - incrémente runs/{runId}.jackpot du bonus du jour:
 *       Dim..Ven +2, Sam +5
 *   - idempotent via runs/{runId}.lastDailyBonusYmd
 *
 * IMPORTANT:
 * - Le payout du jackpot (incluant ce boni) est fait par finalizeAscensionCycleWinners
 *   quand un ou plusieurs membres complètent les 7 étapes.
 */
export const applyAscensionDailyBonus = onSchedule(
  {
    // ✅ après les jobs de fin de nuit (Montréal)
    schedule: "10 5 * * *",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const now = new Date();
    const todayYmd = ymdNowInAppTz(now);
    const dailyBonus = dailyBonusForAsc7(now);

    const groups = await listGroupsWithAsc7Enabled();
    if (!groups.length) {
      logger.info("[applyAscensionDailyBonus] no ASC7-enabled groups", { todayYmd, dailyBonus });
      return;
    }

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const g of groups) {
      const groupId = String(g.id);

      try {
        const ascRootRef = db.doc(`groups/${groupId}/ascensions/${ASC_KEY}`);

        const res = await db.runTransaction(async (tx) => {
          const ascSnap = await tx.get(ascRootRef);
          const ascRoot = ascSnap.exists ? ascSnap.data() || {} : {};

          if (ascRoot.enabled === false) return { ok: true, skipped: true, reason: "asc-disabled" };

          const runId = ascRoot.activeRunId ? String(ascRoot.activeRunId) : null;
          if (!runId) return { ok: true, skipped: true, reason: "no-active-run" };

          const runRef = db.doc(`groups/${groupId}/ascensions/${ASC_KEY}/runs/${runId}`);
          const runSnap = await tx.get(runRef);
          if (!runSnap.exists) return { ok: true, skipped: true, reason: "missing-run" };

          const run = runSnap.data() || {};
          const status = String(run.status || "active").toLowerCase();
          if (status === "completed") return { ok: true, skipped: true, reason: "run-completed" };

          // ✅ Idempotence: 1x par jour
          const lastYmd = run.lastDailyBonusYmd ? String(run.lastDailyBonusYmd) : null;
          if (lastYmd === todayYmd) return { ok: true, skipped: true, reason: "already-applied" };

          // ✅ Apply bonus to run jackpot
          tx.set(
            runRef,
            {
              jackpot: FieldValue.increment(dailyBonus),
              lastDailyBonusYmd: todayYmd,
              lastDailyBonusAt: FieldValue.serverTimestamp(),
              lastDailyBonusAmount: dailyBonus,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          // ✅ Optional mirror for UI (handy if home reads ascRoot.jackpotTotal)
          tx.set(
            ascRootRef,
            {
              updatedAt: FieldValue.serverTimestamp(),
              lastDailyBonusYmd: todayYmd,
              lastDailyBonusAt: FieldValue.serverTimestamp(),
              lastDailyBonusAmount: dailyBonus,
              jackpotTotal: FieldValue.increment(dailyBonus),
            },
            { merge: true }
          );

          return { ok: true, skipped: false, runId };
        });

        if (res?.ok && res.skipped) skipped++;
        else if (res?.ok) applied++;
        else skipped++;
      } catch (e) {
        failed++;
        logger.warn("[applyAscensionDailyBonus] failed", { groupId, err: String(e?.message || e) });
      }
    }

    logger.info("[applyAscensionDailyBonus] done", {
      todayYmd,
      dailyBonus,
      groups: groups.length,
      applied,
      skipped,
      failed,
      ascKey: ASC_KEY,
    });
  }
);