import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { pickString } from "../teamPredictionChallenges/tpGameSources.js";
import { resolveTeamPredictionBundles } from "./resolveTeamPredictionBundleCore.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

export const resolveTeamPredictionBundleNow = onCall(
  { region: "us-central1", timeoutSeconds: 120, memory: "512MiB" },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const bundleId = pickString(req.data?.bundleId);
    if (!bundleId) {
      throw new HttpsError("invalid-argument", "bundleId requis.");
    }

    const bundleSnap = await db.doc(`team_prediction_bundles/${bundleId}`).get();
    if (!bundleSnap.exists) {
      throw new HttpsError("not-found", "Bundle introuvable.");
    }

    const bundle = bundleSnap.data() || {};
    const groupId = String(bundle.groupId || "");

    const membershipSnap = await db.doc(`group_memberships/${groupId}_${uid}`).get();
    if (!membershipSnap.exists) {
      throw new HttpsError("permission-denied", "Tu n'es pas membre de ce groupe.");
    }

    const result = await resolveTeamPredictionBundles({ db, bundleId });

    return {
      ok: true,
      bundleId,
      ...result,
    };
  }
);
