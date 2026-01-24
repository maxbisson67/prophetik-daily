// functions/participation.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "./utils.js";

// Participation gratuite (plus de friction)
const EDIT_COST = 0; // conservé pour compat, mais non utilisé

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

export const participateInDefiX = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required");

  const defiId = String(req.data?.defiId || "");
  if (!defiId) throw new HttpsError("invalid-argument", "defiId required");

  const clientMutationId = req.data?.clientMutationId
    ? String(req.data.clientMutationId)
    : null;

  const picksIn = Array.isArray(req.data?.picks) ? req.data.picks : [];
  const picks = normalizePicks(picksIn);

  const dRef = db.collection("defis").doc(defiId);
  const pRef = dRef.collection("participations").doc(uid);

  let returnPayload = {
    ok: true,
    newPot: null,
    newBalance: null,     // plus utilisé (participation gratuite)
    alreadyPaid: false,   // on le garde pour compat client (= "déjà inscrit")
    editCharged: false,
    editCost: 0,
    potIncrementApplied: false,
  };

  await db.runTransaction(async (tx) => {
    const [dSnap, pSnap] = await Promise.all([tx.get(dRef), tx.get(pRef)]);

    if (!dSnap.exists) throw new HttpsError("not-found", "defi not found");

    const d = dSnap.data() || {};
    const status = String(d.status || "open").toLowerCase();
    if (status !== "open") throw new HttpsError("failed-precondition", "defi is not open");

    const already = pSnap.exists ? (pSnap.data() || {}) : null;

    // ✅ Idempotence (évite double effet si retry)
    if (clientMutationId && already?.lastMutationId === clientMutationId) {
      returnPayload.alreadyPaid = true; // = inscrit
      returnPayload.newPot = Number(d.pot ?? 0);
      returnPayload.newBalance = null;
      returnPayload.editCharged = false;
      returnPayload.editCost = 0;
      returnPayload.potIncrementApplied = false;
      return;
    }

    const prevPicks = Array.isArray(already?.picks) ? already.picks : [];
    const hasPrevSave = pSnap.exists && prevPicks.length > 0;

    // ✅ Détecter changement (après 1ère sauvegarde)
    const changed = hasPrevSave ? !samePicksByPlayerId(prevPicks, picks) : false;

    // ✅ Montant ajouté à la cagnotte à la 1ère participation (sponsorisé)
    // - recommandé: d.potJoinIncrement (contrôlable par ton createDefi)
    // - fallback: d.type (3x3 => +3)
    // - fallback final: 1
    const potJoinIncrementRaw = d.potJoinIncrement ?? d.type ?? 1;
    const potJoinIncrement = Number(potJoinIncrementRaw);

    if (!Number.isFinite(potJoinIncrement) || potJoinIncrement < 0) {
      throw new HttpsError("failed-precondition", "invalid potJoinIncrement");
    }

    const now = FieldValue.serverTimestamp();
    const joinedAt = already?.joinedAt ?? now;

    // ✅ 1ère inscription?
    const isFirstJoin = !pSnap.exists;

    // ✅ Écriture participation (gratuite)
    tx.set(
      pRef,
      {
        picks,
        joinedAt,
        updatedAt: now,
        lastMutationId: clientMutationId || null,

        // On garde ces champs pour compat / analytics
        paid: false,
        paidAmount: 0,
        paidAt: null,

        ...(hasPrevSave && changed ? { editsCount: FieldValue.increment(1) } : {}),
      },
      { merge: true }
    );

    // ✅ Pot & participantsCount seulement à la 1ère participation du user
    if (isFirstJoin) {
      tx.set(
        dRef,
        {
          pot: FieldValue.increment(potJoinIncrement),
          participantsCount: FieldValue.increment(1),
          updatedAt: now,
        },
        { merge: true }
      );
      returnPayload.potIncrementApplied = true;
    } else {
      tx.set(dRef, { updatedAt: now }, { merge: true });
      returnPayload.potIncrementApplied = false;
    }

    // ✅ Payload
    const oldPot = Number(d.pot ?? 0);
    returnPayload.alreadyPaid = true; // = inscrit
    returnPayload.editCharged = false;
    returnPayload.editCost = 0;

    returnPayload.newBalance = null;
    returnPayload.newPot = isFirstJoin ? oldPot + potJoinIncrement : oldPot;
  });

  return returnPayload;
});