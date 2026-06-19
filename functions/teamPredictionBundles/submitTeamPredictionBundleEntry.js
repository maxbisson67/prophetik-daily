import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { recordParticipantProgressionSafe } from "../achievements/achievementService.js";
import { getDateValue, normalizeLeague, safeUpper } from "../teamPredictionChallenges/tpGameSources.js";
import {
  computeBundleStatus,
  countCompletedPicks,
  isSlotOpenForPick,
  refreshSlotStatuses,
} from "./tpBundleUtils.js";
import { deriveWinnerAbbr } from "./tpBundleScoring.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const MAX_SCORE = 30;

function toNumber(v, def = null) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function isActiveMembership(data = {}) {
  const st = String(data.status || "").toLowerCase();
  if (st) return ["open", "active", "approved"].includes(st);
  return data.active !== false;
}

function pickDisplayName(participant = {}) {
  return (
    participant.displayName ||
    participant.name ||
    participant.firstName ||
    participant.prenom ||
    "Participant"
  );
}

function pickAvatarUrl(participant = {}) {
  if (participant.avatarKind === "jersey") {
    return (
      participant.jerseyFrontUrl ||
      participant.avatarUrl ||
      participant.photoURL ||
      participant.photoUrl ||
      null
    );
  }

  return (
    participant.avatarUrl ||
    participant.photoURL ||
    participant.photoUrl ||
    participant.jerseyFrontUrl ||
    null
  );
}

function normalizePickInput(raw = {}, slot = {}, league) {
  const predictedAwayScore = toNumber(raw.predictedAwayScore, null);
  const predictedHomeScore = toNumber(raw.predictedHomeScore, null);
  let predictedOutcome = safeUpper(raw.predictedOutcome);

  if (!Number.isFinite(predictedAwayScore) || !Number.isFinite(predictedHomeScore)) {
    throw new HttpsError("invalid-argument", "Les scores sont requis.");
  }

  if (predictedAwayScore < 0 || predictedHomeScore < 0) {
    throw new HttpsError("invalid-argument", "Les scores doivent être positifs.");
  }

  if (predictedAwayScore > MAX_SCORE || predictedHomeScore > MAX_SCORE) {
    throw new HttpsError(
      "invalid-argument",
      `Les scores doivent être inférieurs ou égaux à ${MAX_SCORE}.`
    );
  }

  if (predictedAwayScore === predictedHomeScore) {
    throw new HttpsError("invalid-argument", "Le score ne peut pas être égal.");
  }

  if (normalizeLeague(league) === "MLB") {
    predictedOutcome = "FINAL";
  } else if (!["REG", "OT", "TB"].includes(predictedOutcome)) {
    throw new HttpsError("invalid-argument", "predictedOutcome invalide.");
  }

  if (normalizeLeague(league) === "NHL") {
    const diff = Math.abs(predictedAwayScore - predictedHomeScore);
    if (diff > 1 && (predictedOutcome === "OT" || predictedOutcome === "TB")) {
      throw new HttpsError(
        "invalid-argument",
        "OT et TB sont permis seulement si l'écart est de 1 but."
      );
    }
  }

  const winnerAbbr = deriveWinnerAbbr({
    awayAbbr: slot.awayAbbr,
    homeAbbr: slot.homeAbbr,
    awayScore: predictedAwayScore,
    homeScore: predictedHomeScore,
  });

  if (!winnerAbbr) {
    throw new HttpsError("invalid-argument", "Impossible de déduire le gagnant.");
  }

  return {
    predictedAwayScore,
    predictedHomeScore,
    predictedOutcome,
    winnerAbbr,
  };
}

export const submitTeamPredictionBundleEntry = onCall(
  { region: "us-central1", timeoutSeconds: 60, memory: "256MiB" },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const bundleId = String(req.data?.bundleId || "").trim();
    const picksInput = req.data?.picks;

    if (!bundleId) {
      throw new HttpsError("invalid-argument", "bundleId requis.");
    }

    if (!picksInput || typeof picksInput !== "object" || Array.isArray(picksInput)) {
      throw new HttpsError("invalid-argument", "picks requis (objet gameId -> prédiction).");
    }

    const bundleRef = db.doc(`team_prediction_bundles/${bundleId}`);
    const bundleSnap = await bundleRef.get();

    if (!bundleSnap.exists) {
      throw new HttpsError("not-found", "Bundle TP introuvable.");
    }

    const bundle = bundleSnap.data() || {};
    const league = normalizeLeague(bundle.league);
    const groupId = String(bundle.groupId || "").trim();
    const games = refreshSlotStatuses(bundle.games || []);
    const gameById = new Map(games.map((g) => [String(g.gameId), g]));

    if (!groupId) {
      throw new HttpsError("failed-precondition", "groupId manquant sur le bundle TP.");
    }

    const membershipSnap = await db.doc(`group_memberships/${groupId}_${uid}`).get();
    if (!membershipSnap.exists || !isActiveMembership(membershipSnap.data() || {})) {
      throw new HttpsError("permission-denied", "Tu n'es pas membre actif de ce groupe.");
    }

    const bundleStatus = String(bundle.status || "open").toLowerCase();
    if (["decided", "cancelled"].includes(bundleStatus)) {
      throw new HttpsError("failed-precondition", "Le défi TP est terminé.");
    }

    const normalizedPicks = {};
    for (const [gameIdRaw, rawPick] of Object.entries(picksInput)) {
      const gameId = String(gameIdRaw || "").trim();
      const slot = gameById.get(gameId);

      if (!slot) {
        throw new HttpsError("invalid-argument", `Match inconnu dans le bundle: ${gameId}`);
      }

      if (!isSlotOpenForPick(slot)) {
        throw new HttpsError(
          "failed-precondition",
          `Le match ${slot.awayAbbr} @ ${slot.homeAbbr} n'est plus ouvert aux prédictions.`
        );
      }

      normalizedPicks[gameId] = normalizePickInput(rawPick, slot, league);
    }

    const participantSnap = await db.doc(`participants/${uid}`).get();
    const participant = participantSnap.exists ? participantSnap.data() || {} : {};
    const displayName = pickDisplayName(participant);
    const avatarUrl = pickAvatarUrl(participant);

    const entryRef = db.doc(`team_prediction_bundles/${bundleId}/entries/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const entrySnap = await tx.get(entryRef);
      const existing = entrySnap.exists ? entrySnap.data() || {} : null;
      const mergedPicks = {
        ...(existing?.picks || {}),
        ...normalizedPicks,
      };

      const picksCompletedCount = countCompletedPicks(mergedPicks, games);

      tx.set(
        entryRef,
        {
          uid,
          bundleId,
          groupId,
          displayName,
          avatarUrl,
          picks: mergedPicks,
          picksCompletedCount,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: existing?.createdAt || FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (!entrySnap.exists) {
        tx.set(
          bundleRef,
          {
            games,
            status: computeBundleStatus(games),
            participantsCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        tx.set(
          bundleRef,
          {
            games,
            status: computeBundleStatus(games),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return {
        created: !entrySnap.exists,
        picksCompletedCount,
        savedGameIds: Object.keys(normalizedPicks),
      };
    });

    if (result.created) {
      await recordParticipantProgressionSafe(uid, {
        challengeType: "TP",
        countParticipation: true,
      });
    }

    logger.info("[submitTeamPredictionBundleEntry] success", {
      uid,
      bundleId,
      groupId,
      league,
      created: result.created,
      picksCompletedCount: result.picksCompletedCount,
      savedGameIds: result.savedGameIds,
    });

    return {
      ok: true,
      bundleId,
      created: result.created,
      picksCompletedCount: result.picksCompletedCount,
      savedGameIds: result.savedGameIds,
    };
  }
);
