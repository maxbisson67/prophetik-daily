// functions/finalizeDefiWinners.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

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
function toYMDInTZ(date, timeZone = "America/Toronto") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
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

/* -------------------- FINALIZATION (daily 5AM) ----------------- */
/**
 * Règle demandée:
 * - À 05:00 America/Toronto, finaliser tous les défis:
 *   • dont gameDate == hier, quelque soit le statut (sauf déjà completed)
 *   • ET aussi ceux "open" avec gameDate ≤ hier (au cas où ils n’ont jamais été lancés correctement)
 */
export const finalizeDefiWinners = onSchedule(
  { schedule: "*/2 * * * *", timeZone: "America/Toronto", region: "us-central1" },
  // */2 * * * *
  // 0 5 * * *
  async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yYMD = toYMDInTZ(yesterday, "America/Toronto");

    logger.info(`finalizeDefiWinners@5AM: target=<=${yYMD}`);

    // 1) Tenter la requête sélective (status in)
    let snap;
    try {
      snap = await db
        .collection("defis")
        .where("gameDate", "<=", yYMD) // <= hier
        .where("status", "in", ["open", "live", "awaiting_result"])
        .get();
    } catch (e) {
      // Si "in" échoue (champ absent, index, etc.), fallback uniquement par date
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
      if (status === "completed") continue; // déjà finalisé

      // Récupérer toutes les participations
      const partsSnap = await docSnap.ref.collection("participations").get();
      const parts = partsSnap.docs.map((s) => {
        const v = s.data() || {};
        return { uid: s.id, livePoints: Number(v.livePoints || v.finalPoints || 0) };
      });

      if (!parts.length) {
        await docSnap.ref.set(
          {
            status: "completed",
            winners: [],
            winnerShares: {},
            completedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        logger.info(`defi ${defiId}: completed (no participants)`);
        continue;
      }

      const top = parts.reduce((m, p) => Math.max(m, p.livePoints), -Infinity);
      const winners = parts.filter((p) => p.livePoints === top).map((p) => p.uid);

      await db.runTransaction(async (tx) => {
        const dRef = db.collection("defis").doc(defiId);
        const fresh = await tx.get(dRef);
        if (!fresh.exists) return;
        const cur = fresh.data() || {};
        if (String(cur.status || "").toLowerCase() === "completed") return;

        const pot = Number(cur.pot || d.pot || 0);
        const shares = splitEven(pot, Math.max(1, winners.length));
        const winnerShares = {};
        winners.forEach((uid, i) => {
          winnerShares[uid] = shares[i] || 0;
        });

        // Marquer complété + sauvegarder le breakdown
        tx.set(
          dRef,
          {
            status: "completed",
            winners,
            winnerShares,
            completedAt: FieldValue.serverTimestamp(),
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

        // Créditer les gagnants
        for (let i = 0; i < winners.length; i++) {
          const uid = winners[i];
          const amount = shares[i] || 0;
          if (!(amount > 0)) continue;

          const uRef = db.collection("participants").doc(uid);
          const uSnap = await tx.get(uRef);
          const curU = uSnap.exists ? (uSnap.data() || {}) : {};
          const curBal = readAnyBalance(curU);
          const newBal = curBal + amount;

          tx.set(
            uRef,
            { credits: { balance: newBal, updatedAt: FieldValue.serverTimestamp() } },
            { merge: true }
          );

          const logRef = uRef.collection("credit_logs").doc();
          tx.set(logRef, {
            type: "defi_payout",
            amount,
            fromBalance: curBal,
            toBalance: newBal,
            defiId,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });

      logger.info(`defi ${defiId}: finalized@5AM`, { winners, pot: d.pot || 0 });
    }
  }
);

// Ancien alias conservé pour compat
export const finalizeAwaitingDefis = finalizeDefiWinners;