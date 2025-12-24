// functions/participation.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, readAnyBalance } from "./utils.js";

const EDIT_COST = 1;

// Compare les picks par playerId (ordre important)
function normalizePicks(picks) {
  const arr = Array.isArray(picks) ? picks : [];
  return arr.map((p) => ({
    playerId: String(p?.playerId ?? ""),
    fullName: String(p?.fullName ?? ""),
    teamAbbr: String(p?.teamAbbr ?? "").toUpperCase(),
  }));
}
function samePicksByPlayerId(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (String(a[i]?.playerId ?? "") !== String(b[i]?.playerId ?? "")) return false;
  }
  return true;
}

export const participateInDefi = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required");

  const defiId = String(req.data?.defiId || "");
  if (!defiId) throw new HttpsError("invalid-argument", "defiId required");

  const clientMutationId = req.data?.clientMutationId ? String(req.data.clientMutationId) : null;

  const picksIn = Array.isArray(req.data?.picks) ? req.data.picks : [];
  const picks = normalizePicks(picksIn);

  const dRef = db.collection("defis").doc(defiId);
  const pRef = dRef.collection("participations").doc(uid);
  const uRef = db.collection("participants").doc(uid);

  let returnPayload = {
    ok: true,
    newPot: null,
    newBalance: null,
    alreadyPaid: false,
    editCharged: false,
    editCost: 0,
  };

  await db.runTransaction(async (tx) => {
    const [dSnap, pSnap, uSnap] = await Promise.all([
      tx.get(dRef),
      tx.get(pRef),
      tx.get(uRef),
    ]);

    if (!dSnap.exists) throw new HttpsError("not-found", "defi not found");

    const d = dSnap.data() || {};
    const status = String(d.status || "open").toLowerCase();
    if (status !== "open") throw new HttpsError("failed-precondition", "defi is not open");

    const already = pSnap.exists ? (pSnap.data() || {}) : null;

    // ✅ Idempotence (évite double débit si retry)
    if (clientMutationId && already?.lastMutationId === clientMutationId) {
      const curU = uSnap.exists ? (uSnap.data() || {}) : {};
      const currentBalance = readAnyBalance(curU);
      returnPayload.alreadyPaid = already?.paid === true;
      returnPayload.newBalance = currentBalance;
      returnPayload.newPot = Number(d.pot ?? 0);
      returnPayload.editCharged = false;
      returnPayload.editCost = 0;
      return;
    }

    const alreadyPaid = already?.paid === true;
    const prevPicks = Array.isArray(already?.picks) ? already.picks : [];
    const hasPrevSave = pSnap.exists && prevPicks.length > 0;

    // ✅ Détecter changement (après 1ère sauvegarde)
    const changed = hasPrevSave ? !samePicksByPlayerId(prevPicks, picks) : false;

    const costRaw = d.participationCost ?? d.type ?? 0;
    const cost = Number(costRaw);
    if (!Number.isFinite(cost) || cost < 0) {
      throw new HttpsError("failed-precondition", "invalid participation cost");
    }

    const curU = uSnap.exists ? (uSnap.data() || {}) : {};
    const currentBalance = readAnyBalance(curU);

    // ✅ Besoin de crédits soit pour entrer, soit pour modifier (après 1ère save)
    const needsEntryPay = !alreadyPaid && cost > 0;
    const needsEditPay = hasPrevSave && changed && EDIT_COST > 0;

    const required = (needsEntryPay ? cost : 0) + (needsEditPay ? EDIT_COST : 0);
    if (required > 0 && currentBalance < required) {
      // Message unifié côté client
      throw new HttpsError("failed-precondition", "insufficient credits");
    }

    const now = FieldValue.serverTimestamp();

    // ✅ Écriture participation
    // - joinedAt: conserve si déjà présent
    // - paid: ne set que si pas déjà payé
    // - picks: toujours (on veut permettre changement, et aussi première sauvegarde)
    const joinedAt = already?.joinedAt ?? now;

    tx.set(
      pRef,
      {
        picks,
        joinedAt,
        updatedAt: now,
        lastMutationId: clientMutationId || null,
        ...(alreadyPaid ? {} : { paid: true, paidAmount: cost, paidAt: now }),
        ...(needsEditPay ? { editsCount: FieldValue.increment(1) } : {}),
      },
      { merge: true }
    );

    // ✅ Pot & participantsCount seulement si 1ère entrée payante
    const incParticipants = already ? 0 : 1;

    tx.set(
      dRef,
      {
        ...(needsEntryPay ? { pot: FieldValue.increment(cost) } : {}),
        ...(incParticipants ? { participantsCount: FieldValue.increment(1) } : {}),
        updatedAt: now,
      },
      { merge: true }
    );

    // ✅ Débit crédits (entrée + edit si applicable)
    let newBal = currentBalance;

    if (needsEntryPay) {
      const from = newBal;
      newBal = Math.max(0, newBal - cost);

      tx.set(uRef, { credits: { balance: newBal, updatedAt: now } }, { merge: true });
      const logRef = uRef.collection("credit_logs").doc();
      tx.set(logRef, {
        type: "defi_entry",
        amount: -cost,
        fromBalance: from,
        toBalance: newBal,
        defiId,
        createdAt: now,
      });
    }

    if (needsEditPay) {
      const from = newBal;
      newBal = Math.max(0, newBal - EDIT_COST);

      tx.set(uRef, { credits: { balance: newBal, updatedAt: now } }, { merge: true });
      const logRef = uRef.collection("credit_logs").doc();
      tx.set(logRef, {
        type: "defi_edit",
        amount: -EDIT_COST,
        fromBalance: from,
        toBalance: newBal,
        defiId,
        createdAt: now,
      });

      returnPayload.editCharged = true;
      returnPayload.editCost = EDIT_COST;
    } else {
      returnPayload.editCharged = false;
      returnPayload.editCost = 0;
    }

    returnPayload.newBalance = newBal;

    const oldPot = Number(d.pot ?? 0);
    returnPayload.alreadyPaid = alreadyPaid || needsEntryPay;
    returnPayload.newPot = needsEntryPay ? oldPot + cost : oldPot;
  });

  return returnPayload;
});