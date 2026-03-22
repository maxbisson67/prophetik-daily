// functions/ascensions/finalizeAscensionCycleWinners.js
// ⚠️ Nom inchangé, mais logique RUN-BASED pour ASC7

import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { APP_TZ, appYmd } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

/* ---------------- helpers ---------------- */
function hasAllSeven(winsByType) {
  if (!winsByType || typeof winsByType !== "object") return false;

  for (let i = 1; i <= 7; i++) {
    if ((winsByType[String(i)] ?? 0) < 1) return false;
  }

  return true;
}

function splitEven(total, n) {
  if (n <= 0 || !(total > 0)) return Array.from({ length: Math.max(0, n) }, () => 0);
  const base = Math.floor(total / n);
  let r = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < r ? base + 1 : base));
}

function numOrNull(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

function readAnyBalance(doc) {
  return (
    numOrNull(doc?.credits?.balance) ??
    numOrNull(doc?.credits) ??
    numOrNull(doc?.credit) ??
    numOrNull(doc?.balance) ??
    0
  );
}

/* ---------------- main ---------------- */
/**
 * finalizeAscensionRuns (ASC7):
 * - traite defis COMPLETED + ASC7 + runProcessed==false
 * - progression: runs/{runId}/members/{uid}.winsByType[stepType]=true
 * - si 1+ winner complète 1..7 sur CE défi => complete run + payout jackpot (splitEven)
 * - idempotent via defis/{defiId}.ascension.runProcessed=true
 */
export const finalizeAscensionCycleWinners = onSchedule(
  {
    //schedule: "*/1 * * * *",
    schedule: "15 5 * * *", // 5:15 AM
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const today = appYmd(new Date());
    let snap;
    try {
        snap = await db
          .collection("defis")
          .where("status", "==", "completed")
          .where("ascension.key", "==", "ASC7")
          .where("ascension.runProcessed", "==", false) // ✅ only unprocessed
          .orderBy("completedAt", "asc")
          .limit(250)
          .get()
    } catch (e) {
      logger.error("[finalizeAscensionRuns] query failed", { err: String(e?.message || e) });
      return;
    }

    if (!snap || snap.empty) {
      logger.info("[finalizeAscensionRuns] no unprocessed ASC7 defis", { today });
      return;
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let completedRuns = 0;

    for (const doc of snap.docs) {
      const defiId = doc.id;

      try {
        const r = await db.runTransaction(async (tx) => {
          const dRef = db.doc(`defis/${defiId}`);
          const dSnap = await tx.get(dRef);
          if (!dSnap.exists) return { ok: false, reason: "missing-defi" };

          const d = dSnap.data() || {};
          const asc = d.ascension || {};
          if (String(asc.key || "").toUpperCase() !== "ASC7") {
            return { ok: false, reason: "not-asc7" };
          }

          if (asc.runProcessed === true) {
            return { ok: true, skipped: true, reason: "already-processed" };
          }

          const groupId = d.groupId ? String(d.groupId) : null;
          const runId = asc.runId ? String(asc.runId) : null;
          const stepType = Number(asc.stepType ?? 0);

          if (!groupId || !runId || !(stepType >= 1 && stepType <= 7)) {
            tx.set(
              dRef,
              { ascension: { ...asc, runProcessed: true, runProcessedNote: "bad-asc-fields" } },
              { merge: true }
            );
            return { ok: true, skipped: true, reason: "bad-asc-fields" };
          }

          const winners = Array.isArray(d.winners) ? d.winners.map(String) : [];
          if (!winners.length) {
            tx.set(
              dRef,
              { ascension: { ...asc, runProcessed: true, runProcessedNote: "no-winners" } },
              { merge: true }
            );
            return { ok: true, skipped: true, reason: "no-winners" };
          }

          const runRef = db.doc(`groups/${groupId}/ascensions/ASC7/runs/${runId}`);
          const runSnap = await tx.get(runRef);
          if (!runSnap.exists) {
            tx.set(
              dRef,
              { ascension: { ...asc, runProcessed: true, runProcessedNote: "missing-run" } },
              { merge: true }
            );
            return { ok: true, skipped: true, reason: "missing-run" };
          }

          const run = runSnap.data() || {};
          if (String(run.status || "active").toLowerCase() === "completed") {
            tx.set(
              dRef,
              { ascension: { ...asc, runProcessed: true, runProcessedNote: "run-already-completed" } },
              { merge: true }
            );
            return { ok: true, skipped: true, reason: "run-already-completed" };
          }

          // -------------------------
          // PHASE 1: ALL READS FIRST
          // -------------------------
          const memberRefs = winners.map((uid) => runRef.collection("members").doc(uid));
          const memberSnaps = await Promise.all(memberRefs.map((ref) => tx.get(ref)));

          const membersByUid = new Map();
          const newlyCompletedUids = [];

          for (let i = 0; i < winners.length; i++) {
            const uid = winners[i];
            const mSnap = memberSnaps[i];
            const m = mSnap.exists ? mSnap.data() || {} : {};
            const winsByType =
              m.winsByType && typeof m.winsByType === "object" ? { ...m.winsByType } : {};

            const k = String(stepType);
            winsByType[k] = (winsByType[k] ?? 0) + 1;

            const completedNow = hasAllSeven(winsByType);
            if (completedNow && m.completed !== true) newlyCompletedUids.push(uid);

            membersByUid.set(uid, {
              ref: memberRefs[i],
              exists: mSnap.exists,
              winsByType,
              completedNow,
            });
          }

          let payoutUsers = [];
          let shares = [];

          if (newlyCompletedUids.length) {
            const jackpot = Number(run.jackpot ?? 0);
            shares = splitEven(jackpot, newlyCompletedUids.length);

            const payoutRefs = newlyCompletedUids.map((uid) => db.collection("participants").doc(uid));
            const payoutSnaps = await Promise.all(payoutRefs.map((ref) => tx.get(ref)));

            payoutUsers = newlyCompletedUids.map((uid, i) => {
              const uSnap = payoutSnaps[i];
              const curU = uSnap.exists ? uSnap.data() || {} : {};
              const curBal = readAnyBalance(curU);
              return {
                uid,
                ref: payoutRefs[i],
                curBal,
                amount: shares[i] || 0,
              };
            });
          }

          // -------------------------
          // PHASE 2: WRITES ONLY
          // -------------------------
          for (const uid of winners) {
            const info = membersByUid.get(uid);
            tx.set(
              info.ref,
              {
                uid,
                groupId,
                runId,
                ascKey: "ASC7",
                winsByType: info.winsByType,
                completed: info.completedNow,
                updatedAt: FieldValue.serverTimestamp(),
                ...(info.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
              },
              { merge: true }
            );
          }

          let runCompleted = false;

          if (newlyCompletedUids.length) {
            for (const p of payoutUsers) {
              if (!(p.amount > 0)) continue;

              tx.set(
                p.ref,
                {
                  "credits.balance": FieldValue.increment(p.amount),
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              const logRef = p.ref.collection("credit_logs").doc();
              tx.set(logRef, {
                type: "ascension_jackpot",
                amount: p.amount,
                fromBalance: p.curBal,
                toBalance: p.curBal + p.amount,
                runId,
                groupId,
                defiId,
                createdAt: FieldValue.serverTimestamp(),
              });
            }

            tx.set(
              runRef,
              {
                status: "completed",
                winnerUids: newlyCompletedUids,
                completedAt: FieldValue.serverTimestamp(),
                completedDefiId: defiId,
                completedStepType: stepType,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            const ascRootRef = db.doc(`groups/${groupId}/ascensions/ASC7`);
            tx.set(
              ascRootRef,
              {
                activeRunId: null,
                lastCompletedRunId: runId,
                lastWinners: newlyCompletedUids,
                lastWinnerAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            runCompleted = true;
          }

          tx.set(
            dRef,
            {
              ascension: {
                ...asc,
                runProcessed: true,
                runProcessedAt: FieldValue.serverTimestamp(),
                runProcessedNote: newlyCompletedUids.length ? "advanced+completed?" : "advanced",
              },
            },
            { merge: true }
          );

          return { ok: true, skipped: false, runCompleted };
        });

        if (r?.ok && r.skipped) skipped++;
        else if (r?.ok) {
          processed++;
          if (r.runCompleted) completedRuns++;
        } else {
          skipped++;
        }
      } catch (e) {
        failed++;
        logger.warn("[finalizeAscensionRuns] failed", { defiId, err: String(e?.message || e) });
      }
    }

    logger.info("[finalizeAscensionRuns] done", {
      today,
      scanned: snap.size,
      processed,
      skipped,
      failed,
      completedRuns,
    });
  }
);