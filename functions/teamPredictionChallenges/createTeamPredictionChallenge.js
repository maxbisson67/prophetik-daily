import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { pickString, normalizeLeague } from "./tpGameSources.js";
import { assertManualChallengeCreationAllowed } from "../groups/manualChallengeLimits.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

function isOwnerRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

/**
 * Legacy TP mono-match — remplacé par createTeamPredictionBundle.
 * En mode manuel, redirige vers le bundle (max 2 matchs / jour / groupe).
 */
export const createTeamPredictionChallenge = onCall(
  { region: "us-central1", timeoutSeconds: 60, memory: "512MiB" },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const groupId = pickString(req.data?.groupId);
    const gameId = pickString(req.data?.gameId);
    const league = normalizeLeague(req.data?.league);

    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId requis.");
    }

    if (!gameId) {
      throw new HttpsError("invalid-argument", "gameId requis.");
    }

    logger.info("[createTeamPredictionChallenge] start", { uid, groupId, gameId, league });

    const membershipSnap = await db.doc(`group_memberships/${groupId}_${uid}`).get();

    if (!membershipSnap.exists) {
      throw new HttpsError("permission-denied", "Tu n'es pas membre de ce groupe.");
    }

    const membership = membershipSnap.data() || {};
    if (!isOwnerRole(membership.role)) {
      throw new HttpsError("permission-denied", "Seul le owner/admin peut créer un défi TP.");
    }

    const groupSnap = await db.doc(`groups/${groupId}`).get();
    if (!groupSnap.exists) {
      throw new HttpsError("not-found", "Groupe introuvable.");
    }

    assertManualChallengeCreationAllowed(groupSnap.data() || {});

    throw new HttpsError(
      "failed-precondition",
      "En mode manuel, utilise un seul défi TP par jour (jusqu'à 2 matchs)."
    );
  }
);
