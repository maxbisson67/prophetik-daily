import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

if (!getApps().length) initializeApp();

const db = getFirestore();

function toNumber(v, def = null) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function getDateValue(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isActiveMembership(data = {}) {
  const st = String(data.status || "").toLowerCase();
  if (st) return ["open", "active", "approved"].includes(st);
  return data.active !== false;
}

function deriveWinnerAbbr({ awayAbbr, homeAbbr, awayScore, homeScore }) {
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return null;
  if (awayScore === homeScore) return null;
  return awayScore > homeScore ? awayAbbr : homeAbbr;
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

export const submitTeamPredictionEntry = onCall(
  { region: "us-central1", timeoutSeconds: 60, memory: "256MiB" },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const challengeId = String(req.data?.challengeId || "").trim();
    const predictedAwayScore = toNumber(req.data?.predictedAwayScore, null);
    const predictedHomeScore = toNumber(req.data?.predictedHomeScore, null);
    const predictedOutcome = safeUpper(req.data?.predictedOutcome);

    if (!challengeId) {
      throw new HttpsError("invalid-argument", "challengeId requis.");
    }

    if (!Number.isFinite(predictedAwayScore) || !Number.isFinite(predictedHomeScore)) {
      throw new HttpsError("invalid-argument", "Les scores sont requis.");
    }

    if (predictedAwayScore < 0 || predictedHomeScore < 0) {
      throw new HttpsError("invalid-argument", "Les scores doivent être positifs.");
    }

    if (!["REG", "OT", "TB"].includes(predictedOutcome)) {
      throw new HttpsError("invalid-argument", "predictedOutcome invalide.");
    }

    if (predictedAwayScore === predictedHomeScore) {
      throw new HttpsError("invalid-argument", "Le score ne peut pas être égal.");
    }

    const diff = Math.abs(predictedAwayScore - predictedHomeScore);
    if (diff > 1 && (predictedOutcome === "OT" || predictedOutcome === "TB")) {
      throw new HttpsError(
        "invalid-argument",
        "OT et TB sont permis seulement si l’écart est de 1 but."
      );
    }

    const challengeRef = db.doc(`team_prediction_challenges/${challengeId}`);
    const challengeSnap = await challengeRef.get();

    if (!challengeSnap.exists) {
      throw new HttpsError("not-found", "Défi TP introuvable.");
    }

    const challenge = challengeSnap.data() || {};
    const groupId = String(challenge.groupId || "").trim();

    if (!groupId) {
      throw new HttpsError("failed-precondition", "groupId manquant sur le défi TP.");
    }

    const membershipRef = db.doc(`group_memberships/${groupId}_${uid}`);
    const membershipSnap = await membershipRef.get();

    if (!membershipSnap.exists || !isActiveMembership(membershipSnap.data() || {})) {
      throw new HttpsError("permission-denied", "Tu n’es pas membre actif de ce groupe.");
    }

    const status = String(challenge.status || "").toLowerCase();
    if (status !== "open") {
      throw new HttpsError("failed-precondition", "Le défi TP n’est plus ouvert.");
    }

    const lockedAt = getDateValue(challenge.lockedAt);
    if (lockedAt && Date.now() >= lockedAt.getTime()) {
      throw new HttpsError("failed-precondition", "Le défi TP est maintenant verrouillé.");
    }

    const awayAbbr = safeUpper(challenge.awayAbbr);
    const homeAbbr = safeUpper(challenge.homeAbbr);

    if (!awayAbbr || !homeAbbr) {
      throw new HttpsError("failed-precondition", "Les équipes du défi TP sont incomplètes.");
    }

    const winnerAbbr = deriveWinnerAbbr({
      awayAbbr,
      homeAbbr,
      awayScore: predictedAwayScore,
      homeScore: predictedHomeScore,
    });

    if (!winnerAbbr) {
      throw new HttpsError("invalid-argument", "Impossible de déduire le gagnant.");
    }

    const participantRef = db.doc(`participants/${uid}`);
    const participantSnap = await participantRef.get();
    const participant = participantSnap.exists ? participantSnap.data() || {} : {};

    const displayName = pickDisplayName(participant);
    const avatarUrl = pickAvatarUrl(participant);

    const entryRef = db.doc(`team_prediction_challenges/${challengeId}/entries/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const existingSnap = await tx.get(entryRef);
      const existing = existingSnap.exists ? existingSnap.data() || {} : null;

      tx.set(
        entryRef,
        {
          uid,
          challengeId,
          groupId,

          displayName,
          avatarUrl,

          winnerAbbr,
          predictedAwayScore,
          predictedHomeScore,
          predictedOutcome,

          updatedAt: FieldValue.serverTimestamp(),
          createdAt: existing?.createdAt || FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (!existingSnap.exists) {
        tx.set(
          challengeRef,
          {
            participantsCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        tx.set(
          challengeRef,
          {
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return {
        created: !existingSnap.exists,
        winnerAbbr,
      };
    });

    logger.info("[submitTeamPredictionEntry] success", {
      uid,
      challengeId,
      groupId,
      created: result.created,
      displayName,
      hasAvatarUrl: !!avatarUrl,
      winnerAbbr,
      predictedAwayScore,
      predictedHomeScore,
      predictedOutcome,
    });

    return {
      ok: true,
      challengeId,
      created: result.created,
      winnerAbbr,
      predictedAwayScore,
      predictedHomeScore,
      predictedOutcome,
    };
  }
);