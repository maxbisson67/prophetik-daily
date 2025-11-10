// functions/purchaseAvatar.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "./utils.js";

/**
 * purchaseAvatar
 * data: { avatarId: string, price: number, photoURL?: string }
 * - Déduit les crédits (credits.balance)
 * - Met à jour l’avatar (photoURL ou avatarUrl)
 * - Journalise dans participants/{uid}/credit_logs/*
 */
export const purchaseAvatar = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Tu dois être connecté pour acheter un avatar.");
  }

  const { avatarId, price, photoURL } = req.data || {};
  const cost = Number(price);
  if (!avatarId || !Number.isFinite(cost) || cost <= 0) {
    throw new HttpsError("invalid-argument", "Paramètres invalides: avatarId et price requis.");
  }

  const pRef = db.collection("participants").doc(uid);
  const logRef = pRef.collection("credit_logs").doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(pRef);
    if (!snap.exists) {
      throw new HttpsError("failed-precondition", "Profil participant introuvable.");
    }

    const data = snap.data() || {};
    const before = Number(data?.credits?.balance ?? 0);
    if (!Number.isFinite(before) || before < cost) {
      throw new HttpsError("failed-precondition", "Crédits insuffisants.");
    }
    const after = before - cost;

    // Patch avatar (garde la propriété réellement utilisée par l’app)
    const avatarPatch = {};
    if (photoURL) {
      avatarPatch.photoURL = String(photoURL);
    } else {
      // Option: si tu utilises des IDs d’avatars internes
      avatarPatch.avatarId = String(avatarId);
    }

    // Update participant (schéma existant: credits.balance + timestamps)
    tx.update(pRef, {
      ...avatarPatch,
      "credits.balance": after,
      "credits.updatedAt": FieldValue.serverTimestamp(),
      avatarPurchasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Log de l’opération
    tx.set(logRef, {
      type: "purchase_avatar",
      avatarId: String(avatarId),
      avatarUrl: photoURL || null,
      amount: -cost,
      before,
      after,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});