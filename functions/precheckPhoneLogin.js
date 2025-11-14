// functions/precheckPhoneLogin.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// 🔥 Initialisation propre (évite "already exists")
const app = getApps().length ? getApp() : initializeApp();
const adminAuth = getAuth(app);

// Validation du format E.164 (ex: +15145551234)
function validateE164(phone) {
  return /^\+\d{8,15}$/.test(String(phone || "").trim());
}

export const precheckPhoneLogin = onCall({ region: "us-central1" }, async (req) => {
  const phone = String(req.data?.phone ?? "").trim();

  if (!validateE164(phone)) {
    throw new HttpsError("invalid-argument", "Phone must be E.164 (e.g. +15145551234)");
  }

  try {
    await adminAuth.getUserByPhoneNumber(phone);
    return { allowed: true };
  } catch (e) {
    if (e?.code === "auth/user-not-found") return { allowed: false };
    console.error("[precheckPhoneLogin] error:", e);
    throw new HttpsError("internal", "Lookup failed");
  }
});