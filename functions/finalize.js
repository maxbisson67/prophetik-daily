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
function ymdValueFromDocField(docVal, tz = "America/Toronto") {
  if (typeof docVal === "string") return docVal.slice(0, 10);
  const d = readTS(docVal);
  return d ? toYMDInTZ(d, tz) : null;
}

/* -------------------- FINALIZATION (every 5 AM in the morning) ----------------- */
export const finalizeDefiWinners = onSchedule(
  { schedule: "0 5 * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yYMD = toYMDInTZ(yesterday, "America/Toronto");

    logger.info(`finalizeDefiWinners: target <= ${yYMD}`);

    // 1) Tentative indexée
    let snap;
    try {
      snap = await db
        .collection("defis")
        .where("gameDate", "<=", yYMD)
        .where("status", "in", ["open", "live", "awaiting_result"])
        .get();
    } catch (e) {
      logger.warn("finalizeDefiWinners: primary query failed, try fallback", String(e));
      snap = null;
    }

    let candidates = [];
    let reason = "primary";
    if (snap && !snap.empty) {
      candidates = snap.docs;
      logger.info(`finalizeDefiWinners: primary candidates=${snap.size}`);
    } else {
      // 2) Fallback: scan par status puis filtrage côté code
      reason = "fallback-status-scan";
      const stSnap = await db
        .collection("defis")
        .where("status", "in", ["open", "live", "awaiting_result"])
        .get();

      const filtered = [];
      stSnap.forEach((d) => {
        const val = d.data() || {};
        const gameY = ymdValueFromDocField(val.gameDate, "America/Toronto");
        const endY = ymdValueFromDocField(val.endAt, "America/Toronto");
        const startY = ymdValueFromDocField(val.startAt, "America/Toronto");
        let keep = false;
        if (gameY && gameY <= yYMD) keep = true;
        else if (!gameY && endY && endY <= yYMD) keep = true;
        else if (!gameY && !endY && startY && startY <= yYMD) keep = true;
        if (keep) filtered.push(d);
      });

      candidates = filtered;
      logger.info(`finalizeDefiWinners: fallback candidates=${filtered.length}`);
    }

    if (!candidates.length) {
      logger.info("finalizeDefiWinners: none", { reason });
      return;
    }

    for (const docSnap of candidates) {
      const defiId = docSnap.id;
      const d = docSnap.data() || {};
      const status = String(d.status || "").toLowerCase();
      if (status === "completed") continue;

      // Participations (en dehors de la transaction — OK)
      const partsSnap = await docSnap.ref.collection("participations").get();
      const parts = partsSnap.docs.map((s) => {
        const v = s.data() || {};
        return { uid: s.id, livePoints: Number(v.livePoints || v.finalPoints || 0) };
      });

      if (!parts.length) {
        await docSnap.ref.set(
          { status: "completed", winners: [], winnerShares: {}, completedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        logger.info(`defi ${defiId}: completed (no participants)`);
        continue;
      }

      const top = parts.reduce((m, p) => Math.max(m, p.livePoints), -Infinity);
      const winners = parts.filter((p) => p.livePoints === top).map((p) => p.uid);

      // ✅ Transaction : TOUTES LES LECTURES AVANT TOUTE ÉCRITURE
      await db.runTransaction(async (tx) => {
        const dRef = db.collection("defis").doc(defiId);

        // --- 1) LECTURES ---
        const fresh = await tx.get(dRef); // défi
        if (!fresh.exists) return;
        const cur = fresh.data() || {};
        if (String(cur.status || "").toLowerCase() === "completed") return;

        // Lire les participants gagnants AVANT d'écrire
        const winnerSnaps = {};
        for (const uid of winners) {
          const uRef = db.collection("participants").doc(uid);
          const uSnap = await tx.get(uRef);
          winnerSnaps[uid] = uSnap.exists ? (uSnap.data() || {}) : null;
        }

        // --- 2) CALCULS ---
        const pot = Number(cur.pot || d.pot || 0);
        const shares = splitEven(pot, Math.max(1, winners.length));
        const winnerShares = {};
        winners.forEach((uid, i) => { winnerShares[uid] = shares[i] || 0; });

        // --- 3) ÉCRITURES ---
        // a) Défi -> completed + breakdown
        tx.set(
          dRef,
          { status: "completed", winners, winnerShares, completedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );

        // b) Participations -> finalPoints + payout
        for (const p of parts) {
          const payout = winners.includes(p.uid) ? (winnerShares[p.uid] || 0) : 0;
          tx.set(
            dRef.collection("participations").doc(p.uid),
            { finalPoints: p.livePoints, payout, finalizedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }

        // c) Crédits gagnants + logs
        for (let i = 0; i < winners.length; i++) {
          const uid = winners[i];
          const amount = shares[i] || 0;
          if (!(amount > 0)) continue;

          const uRef = db.collection("participants").doc(uid);
          const current = winnerSnaps[uid] || {};
          const curBal = readAnyBalance(current);
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

      logger.info(`defi ${defiId}: finalized`, { winners, pot: d.pot || 0, reason });
    }
  }
);

// Alias historique
export const finalizeAwaitingDefis = finalizeDefiWinners;