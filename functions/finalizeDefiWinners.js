// functions/finalizeDefiWinners.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import crypto from "crypto";

// 🔁 NEW: on importe le helper d’ingest
import { runIngestStatsForDate } from "./ingest.js";

// 🔁 NEW: on centralise la logique de date/fuseau
import { APP_TZ, appYmd, addDaysToYmd, formatDebug } from "./ProphetikDate.js";

/* ------------------------- Admin init ------------------------- */
if (getApps().length === 0) initializeApp();
const db = getFirestore();

/* --------------------------- Helpers -------------------------- */
function readTS(v) {
  return v?.toDate?.() ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null;
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

/** Bonus 6x7 déterministe (idempotent) */
function pickDeterministicFromValues(defiId, values = []) {
  const arr = Array.isArray(values)
    ? values.filter((x) => Number.isFinite(Number(x))).map((x) => Number(x))
    : [];
  if (!arr.length) return 0;

  const hex = crypto.createHash("sha256").update(String(defiId)).digest("hex");
  const n = parseInt(hex.slice(0, 8), 16); // 32-bit
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

/* -------------------- FINALIZATION (daily 5AM) ----------------- */
/**
 * Règle:
 * - À 05:00 APP_TZ (America/Toronto), finaliser tous les défis:
 *   • dont gameDate == hier (APP_TZ), quelque soit le statut (sauf déjà completed)
 *   • ET aussi ceux "open" avec gameDate ≤ hier (au cas où ils n’ont jamais été lancés correctement)
 *
 * Avant de finaliser, on lance une dernière synchro live (runIngestStatsForDate)
 * pour garantir que livePoints est à jour.
 *
 * ✅ Bonus optionnel 6x7:
 * - si le défi contient bonusReward: { type:"random", values:[6,7] }
 * - on crédite chaque gagnant d’un bonus déterministe (6 ou 7) en plus du pot
 * - idempotent car le bonus est dérivé du defiId (hash)
 */
export const finalizeDefiWinners = onSchedule(
  {
    // en prod: "0 5 * * *"
    schedule: "*/2 * * * *",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const now = new Date();

    // 🔁 0) Dernière synchro live avant de figer les résultats
    try {
      logger.info("finalizeDefiWinners: running runIngestStatsForDate() before finalization");
      await runIngestStatsForDate();
      logger.info("finalizeDefiWinners: ingest done");
    } catch (e) {
      logger.error("finalizeDefiWinners: runIngestStatsForDate failed, using last known livePoints", {
        error: String(e?.message || e),
      });
    }

    // 1) Cible: tous les défis dont gameDate ≤ hier (APP_TZ)
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
      if (status === "completed") continue;

      // ✅ Bonus par gagnant (6 ou 7) si configuré sur le défi
      const bonusPerWinner = computeBonusPerWinner(defiId, d);

      // 3) Récupérer toutes les participations avec leurs livePoints
      const partsSnap = await docSnap.ref.collection("participations").get();
      const parts = partsSnap.docs.map((s) => {
        const v = s.data() || {};
        return {
          uid: s.id,
          livePoints: Number(v.livePoints ?? v.finalPoints ?? 0),
        };
      });

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

      // 4) Déterminer le score max + liste des gagnants (ex aequo)
      const top = parts.reduce((m, p) => Math.max(m, p.livePoints), -Infinity);
      const winners = parts.filter((p) => p.livePoints === top).map((p) => p.uid);

      // 5) Transaction: marquer le défi comme completed + payer les gagnants
      await db.runTransaction(async (tx) => {
        const dRef = db.collection("defis").doc(defiId);
        const fresh = await tx.get(dRef);
        if (!fresh.exists) return;

        const cur = fresh.data() || {};
        if (String(cur.status || "").toLowerCase() === "completed") return;

        const pot = Number(cur.pot ?? d.pot ?? 0);
        const shares = splitEven(pot, Math.max(1, winners.length));
        const winnerShares = {};
        winners.forEach((uid, i) => {
          winnerShares[uid] = shares[i] || 0;
        });

        // Marquer complété + sauvegarder le breakdown (+ bonus si présent)
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

        // Payout + finalPoints sur participations
        for (const p of parts) {
          const payout = winners.includes(p.uid) ? winnerShares[p.uid] || 0 : 0;
          tx.set(
            dRef.collection("participations").doc(p.uid),
            {
              finalPoints: p.livePoints,
              payout,
              finalizedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        // Créditer les gagnants (pot + bonus 6x7)
        for (let i = 0; i < winners.length; i++) {
          const uid = winners[i];

          const potAmount = shares[i] || 0;
          const bonusAmount = bonusPerWinner || 0;

          if (!(potAmount > 0) && !(bonusAmount > 0)) continue;

          const uRef = db.collection("participants").doc(uid);
          const uSnap = await tx.get(uRef);
          const curU = uSnap.exists ? uSnap.data() || {} : {};
          const curBal = readAnyBalance(curU);

          const add = (potAmount > 0 ? potAmount : 0) + (bonusAmount > 0 ? bonusAmount : 0);
          const newBal = curBal + add;

          tx.set(
            uRef,
            {
              credits: { balance: newBal },
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          // Log payout pot (type existant)
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

          // Log bonus 6x7 (nouveau type)
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
              meta: { concept: "6x7", pickedFrom: (d?.bonusReward?.values || [6, 7]) },
            });
          }
        }
      });

      logger.info(`defi ${defiId}: finalized@5AM`, {
        winners,
        pot: d.pot || 0,
        bonusPerWinner,
      });
    }
  }
);

// Ancien alias conservé pour compat
export const finalizeAwaitingDefis = finalizeDefiWinners;