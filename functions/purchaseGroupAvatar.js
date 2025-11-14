// functions/purchaseGroupAvatar.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "./utils.js";

export const purchaseGroupAvatar = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

  const { groupId, avatarId, price, avatarUrl } = req.data || {};
  const p = Number(price);
  if (!groupId || !avatarId || !Number.isFinite(p) || p <= 0) {
    throw new HttpsError("invalid-argument", "Paramètres invalides.");
  }

  const userRef  = db.collection("participants").doc(uid);
  const groupRef = db.collection("groups").doc(String(groupId));
  const logRef   = userRef.collection("credit_logs").doc();

  await db.runTransaction(async (tx) => {
    const [userSnap, groupSnap] = await Promise.all([tx.get(userRef), tx.get(groupRef)]);
    if (!userSnap.exists) throw new HttpsError("failed-precondition", "Profil introuvable.");
    if (!groupSnap.exists) throw new HttpsError("failed-precondition", "Groupe introuvable.");

    const g = groupSnap.data() || {};
    const canManage =
      g.ownerId === uid ||
      g.createdBy === uid ||
      (g.ownerUid && String(g.ownerUid) === uid) ||
      (Array.isArray(g.admins) && g.admins.includes(uid));
    if (!canManage) throw new HttpsError("permission-denied", "Tu ne peux pas gérer ce groupe.");

    const u = userSnap.data() || {};
    const balRaw =
    (typeof u?.credits === "number" ? u.credits : undefined) ??
    (typeof u?.credits?.balance === "number" ? u.credits.balance : undefined) ??
    (typeof u?.balance === "number" ? u.balance : undefined);

    const bal = Number.isFinite(balRaw) ? balRaw : 0;
    if (bal < p) throw new HttpsError("failed-precondition", "Crédits insuffisants.");

    const newBal = bal - p;

    tx.set(userRef, { credits: { balance: newBal, updatedAt: FieldValue.serverTimestamp() } }, { merge: true });
    tx.set(groupRef, {
      avatarId,
      avatarUrl: avatarUrl || null,
      avatarPurchasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.set(logRef, {
      type: "purchase_group_avatar",
      groupId: String(groupId),
      avatarId,
      avatarUrl: avatarUrl || null,
      amount: -p,
      before: bal,
      after: newBal,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});