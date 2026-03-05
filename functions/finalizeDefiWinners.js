// functions/finalizeDefiWinners.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import crypto from "crypto";

import { runIngestStatsForDate } from "./ingest.js";
import { APP_TZ, appYmd, addDaysToYmd, formatDebug } from "./ProphetikDate.js";

/* ------------------------- Admin init ------------------------- */
if (getApps().length === 0) initializeApp();
const db = getFirestore();

/* --------------------------- Helpers -------------------------- */
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

/** Bonus 6x7 déterministe (idempotent) */
function pickDeterministicFromValues(defiId, values = []) {
  const arr = Array.isArray(values)
    ? values.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x))
    : [];
  if (!arr.length) return 0;

  const hex = crypto.createHash("sha256").update(String(defiId)).digest("hex");
  const n = parseInt(hex.slice(0, 8), 16);
  const idx = n % arr.length;
  return Number(arr[idx]) || 0;
}

function computeBonusPerWinner(defiId, defiDoc) {
  const br = defiDoc?.bonusReward;
  if (!br || typeof br !== "object") return 0;

  const type = String(br.type || "").toLowerCase();
  if (type !== "random") return 0;

  const values = br.values || [6, 7];
  const bonus = pickDeterministicFromValues(defiId, values);
  return bonus > 0 ? bonus : 0;
}

/** ✅ détecter "humain vs bot" via doc participant */
async function isHumanUid(uid) {
  try {
    const snap = await db.collection("participants").doc(uid).get();
    if (!snap.exists) return true;
    const d = snap.data() || {};

    const isBotA = d.isBot === true;
    const isBotB = String(d.kind || "").toLowerCase() === "bot";
    const isBotC = String(d.role || "").toLowerCase() === "bot";
    const isBotD = String(d.type || "").toLowerCase() === "bot";

    return !(isBotA || isBotB || isBotC || isBotD);
  } catch (e) {
    logger.warn("isHumanUid: failed, defaulting to HUMAN", {
      uid,
      error: String(e?.message || e),
    });
    return true;
  }
}

/* -------------------- FINALIZATION (daily 5AM) ----------------- */
/**
 * À 05:00 APP_TZ:
 * - finaliser tous les défis gameDate <= hier
 * - status in ["open","live","awaiting_result"] (fallback date-only)
 *
 * ✅ Bonus optionnel 6x7 (deterministic / idempotent)
 * ✅ Si aucun humain => annule
 *
 * ✅ ASCENSION JACKPOT (RUN-BASED):
 * - si d.ascension.key === "ASC7" et d.ascension.runId et groupId
 *   ajouter ceil(pot*0.5) au doc:
 *     groups/{groupId}/ascensions/ASC7/runs/{runId}.jackpot
 *   idempotent via receipt:
 *     .../runs/{runId}/jackpot_contribs/{defiId}
 */
export const finalizeDefiWinners = onSchedule(
  {
    schedule: "0 5 * * *",
    //schedule: "*/1 * * * *", // test toute les minutes
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const now = new Date();

    // 0) Dernière synchro live avant figer
    try {
      logger.info("finalizeDefiWinners: running runIngestStatsForDate() before finalization");
      await runIngestStatsForDate();
      logger.info("finalizeDefiWinners: ingest done");
    } catch (e) {
      logger.error("finalizeDefiWinners: runIngestStatsForDate failed, using last known livePoints", {
        error: String(e?.message || e),
      });
    }

    // 1) Cible: gameDate <= hier (APP_TZ)
    const todayYmd = appYmd(now);
    const yYMD = addDaysToYmd(todayYmd, -1);

    logger.info(
      `finalizeDefiWinners@5AM: nowUTC=${formatDebug(now, "UTC")} todayApp=${todayYmd} target<=${yYMD}`
    );

    // 2) Requête des défis à finaliser
    let snap;
    try {
      snap = await db
        .collection("defis")
        .where("gameDate", "<=", yYMD)
        .where("status", "in", ["open", "live", "awaiting_result"])
        .get();
    } catch (e) {
      logger.warn("finalizeDefiWinners@5AM: status filter failed, fallback date-only", String(e));
      snap = await db.collection("defis").where("gameDate", "<=", yYMD).get();
    }

    if (snap.empty) {
      logger.info("finalizeDefiWinners@5AM: no candidates");
      return;
    }
    logger.info(`finalizeDefiWinners@5AM: candidates=${snap.size}`);

    for (const docSnap of snap.docs) {
      const defiId = docSnap.id;
      const d = docSnap.data() || {};
      const status = String(d.status || "").toLowerCase();
      if (status === "completed" || status === "cancelled") continue;

      const bonusPerWinner = computeBonusPerWinner(defiId, d);

      // 3) Participations
      const partsSnap = await docSnap.ref.collection("participations").get();
      const parts = partsSnap.docs.map((s) => {
        const v = s.data() || {};
        return { uid: s.id, livePoints: Number(v.livePoints ?? v.finalPoints ?? 0) };
      });

      // (A) Aucun participant
      if (!parts.length) {
        await docSnap.ref.set(
          {
            status: "completed",
            winners: [],
            winnerShares: {},
            completedAt: FieldValue.serverTimestamp(),
            ...(bonusPerWinner > 0 ? { bonusPerWinner } : {}),
          },
          { merge: true }
        );
        logger.info(`defi ${defiId}: completed (no participants)`);
        continue;
      }

      // (B) Au moins 1 humain ?
      const humanFlags = await Promise.all(parts.map((p) => isHumanUid(p.uid)));
      const hasHuman = humanFlags.some(Boolean);

      // Aucun humain => annule
      if (!hasHuman) {
        const cancelledPotOriginal = Number(d.pot ?? 0);
        await docSnap.ref.set(
          {
            status: "cancelled",
            cancelReason: "NO_HUMANS",
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledPotOriginal,
            pot: 0,
            winners: [],
            winnerShares: {},
            completedAt: FieldValue.serverTimestamp(),
            payoutAppliedAt: FieldValue.serverTimestamp(),
            payoutAppliedTo: null,
            ...(bonusPerWinner > 0 ? { bonusPerWinner } : {}),
          },
          { merge: true }
        );

        try {
          const batch = db.batch();
          for (const p of partsSnap.docs) {
            batch.set(
              p.ref,
              {
                cancelledAt: FieldValue.serverTimestamp(),
                cancelReason: "NO_HUMANS",
                payout: 0,
                finalizedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          await batch.commit();
        } catch (e) {
          logger.warn(`defi ${defiId}: failed to tag participations as cancelled`, String(e));
        }

        logger.info(`defi ${defiId}: cancelled (NO_HUMANS)`, {
          participants: parts.map((p) => p.uid),
        });
        continue;
      }

      // 4) Winners (ex aequo)
      const top = parts.reduce((m, p) => Math.max(m, p.livePoints), -Infinity);
      const winners = parts.filter((p) => p.livePoints === top).map((p) => p.uid);

      // 5) Transaction: completed + payout + jackpot run
      await db.runTransaction(async (tx) => {
        const dRef = db.collection("defis").doc(defiId);
        const fresh = await tx.get(dRef);
        if (!fresh.exists) return;

        const cur = fresh.data() || {};
        const curStatus = String(cur.status || "").toLowerCase();
        if (curStatus === "completed" || curStatus === "cancelled") return;

        const pot = Number(cur.pot ?? d.pot ?? 0);
        const shares = splitEven(pot, Math.max(1, winners.length));
        const winnerShares = {};
        winners.forEach((uid, i) => (winnerShares[uid] = shares[i] || 0));

        // 5A) Mark completed
        tx.set(
          dRef,
          {
            status: "completed",
            winners,
            winnerShares,
            completedAt: FieldValue.serverTimestamp(),
            ...(bonusPerWinner > 0
              ? {
                  bonusPerWinner,
                  bonusReward: cur.bonusReward || d.bonusReward || { type: "random", values: [6, 7] },
                }
              : {}),
          },
          { merge: true }
        );

        // 5B) participations finalPoints + payout
        for (const p of parts) {
          const payout = winners.includes(p.uid) ? winnerShares[p.uid] || 0 : 0;
          tx.set(
            dRef.collection("participations").doc(p.uid),
            { finalPoints: p.livePoints, payout, finalizedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }

        // 5C) credit winners (pot + bonus) — atomique via increment
        for (let i = 0; i < winners.length; i++) {
          const uid = winners[i];
          const potAmount = shares[i] || 0;
          const bonusAmount = bonusPerWinner || 0;
          const add = (potAmount > 0 ? potAmount : 0) + (bonusAmount > 0 ? bonusAmount : 0);
          if (!(add > 0)) continue;

          const uRef = db.collection("participants").doc(uid);
          const uSnap = await tx.get(uRef);
          const curU = uSnap.exists ? uSnap.data() || {} : {};
          const curBal = readAnyBalance(curU);

          tx.set(
            uRef,
            {
              "credits.balance": FieldValue.increment(add),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          if (potAmount > 0) {
            const logRef = uRef.collection("credit_logs").doc();
            tx.set(logRef, {
              type: "defi_payout",
              amount: potAmount,
              fromBalance: curBal,
              toBalance: curBal + potAmount,
              defiId,
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          if (bonusAmount > 0) {
            const logRef2 = uRef.collection("credit_logs").doc();
            const from2 = curBal + (potAmount > 0 ? potAmount : 0);
            tx.set(logRef2, {
              type: "defi_bonus",
              amount: bonusAmount,
              fromBalance: from2,
              toBalance: from2 + bonusAmount,
              defiId,
              createdAt: FieldValue.serverTimestamp(),
              meta: { concept: "6x7", pickedFrom: d?.bonusReward?.values || [6, 7] },
            });
          }
        }

        /* ---------------- ASCENSION JACKPOT (RUN-BASED) ---------------- */
        const asc = cur.ascension || d.ascension;
        const ascKey = asc?.key ? String(asc.key).toUpperCase() : null;
        const runId = asc?.runId ? String(asc.runId) : null;
        const groupId = cur.groupId || d.groupId;

        if (ascKey === "ASC7" && runId && groupId) {
          const potNow = Number(cur.pot ?? d.pot ?? 0);
          const jackpotAdd = potNow > 0 ? Math.ceil(potNow * 0.5) : 0;

          if (jackpotAdd > 0) {
            const runRef = db.doc(`groups/${groupId}/ascensions/ASC7/runs/${runId}`);
            const receiptRef = runRef.collection("jackpot_contribs").doc(defiId);

            const receiptSnap = await tx.get(receiptRef);
            if (!receiptSnap.exists) {
              tx.set(
                receiptRef,
                {
                  defiId,
                  pot: potNow,
                  jackpotAdd,
                  runId,
                  stepType: asc?.stepType ?? null,
                  createdAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              tx.set(
                runRef,
                {
                  jackpot: FieldValue.increment(jackpotAdd),
                  jackpotUpdatedAt: FieldValue.serverTimestamp(),
                  lastJackpotDefiId: defiId,
                  lastJackpotAdd: jackpotAdd,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }
          }
        }
      });

      logger.info(`defi ${defiId}: finalized@5AM`, { winners, pot: d.pot || 0, bonusPerWinner });
    }
  }
);