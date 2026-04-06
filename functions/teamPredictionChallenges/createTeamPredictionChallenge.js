import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

if (!getApps().length) initializeApp();

const db = getFirestore();

const TP_STAKE_POINTS = 2;
const TP_LOCK_BEFORE_MINUTES = 5;
const TP_EXPIRES_AFTER_DAYS = 2;

function pickString(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function ymdFromDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isOwnerRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

export const createTeamPredictionChallenge = onCall(
  { region: "us-central1", timeoutSeconds: 60, memory: "512MiB" },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const groupId = pickString(req.data?.groupId);
    const gameId = pickString(req.data?.gameId);

    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId requis.");
    }

    if (!gameId) {
      throw new HttpsError("invalid-argument", "gameId requis.");
    }

    logger.info("[createTeamPredictionChallenge] start", { uid, groupId, gameId });

    const membershipRef = db.doc(`group_memberships/${groupId}_${uid}`);
    const membershipSnap = await membershipRef.get();

    if (!membershipSnap.exists) {
      throw new HttpsError("permission-denied", "Tu n'es pas membre de ce groupe.");
    }

    const membership = membershipSnap.data() || {};
    if (!isOwnerRole(membership.role)) {
      throw new HttpsError("permission-denied", "Seul le owner/admin peut créer un défi TP.");
    }

    const todayYmd = ymdFromDate(new Date());

    const gameRef = db.doc(`nhl_schedule_daily/${todayYmd}/games/${gameId}`);
    const gameSnap = await gameRef.get();

    if (!gameSnap.exists) {
      throw new HttpsError(
        "not-found",
        `Match introuvable dans nhl_schedule_daily/${todayYmd}/games/${gameId}.`
      );
    }

    const game = gameSnap.data() || {};

    const awayAbbr = safeUpper(game.away?.abbr);
    const homeAbbr = safeUpper(game.home?.abbr);
    const startTimeUTC = pickString(game.startTimeUTC);
    const gameState = safeUpper(game.gameState);

    if (!awayAbbr || !homeAbbr || !startTimeUTC) {
      throw new HttpsError(
        "failed-precondition",
        "Les données du match sont incomplètes (away/home/startTimeUTC)."
      );
    }

    if (gameState === "OFF") {
      throw new HttpsError(
        "failed-precondition",
        "Impossible de créer un TP sur un match déjà terminé."
      );
    }

    const startDate = new Date(startTimeUTC);
    if (Number.isNaN(startDate.getTime())) {
      throw new HttpsError("failed-precondition", "startTimeUTC invalide.");
    }

    const lockedAtDate = new Date(
      startDate.getTime() - TP_LOCK_BEFORE_MINUTES * 60 * 1000
    );
    const expiresAtDate = addDays(new Date(), TP_EXPIRES_AFTER_DAYS);

    if (Date.now() >= lockedAtDate.getTime()) {
      throw new HttpsError(
        "failed-precondition",
        "Impossible de créer un TP moins de 5 minutes avant le début du match."
      );
    }

    const challengeId = `tp_${groupId}_${gameId}`;
    const challengeRef = db.doc(`team_prediction_challenges/${challengeId}`);
    const challengeSnap = await challengeRef.get();

    if (challengeSnap.exists) {
      const existing = challengeSnap.data() || {};
      const status = String(existing.status || "").toLowerCase();

      if (["open", "locked", "decided"].includes(status)) {
        throw new HttpsError(
          "already-exists",
          "Un défi TP existe déjà pour ce match dans ce groupe."
        );
      }
    }

    // Jackpot carry-in lu depuis le groupe (aligné avec applyTeamPredictionPayout)
    const groupRef = db.doc(`groups/${groupId}`);
    const groupSnap = await groupRef.get();
    const groupData = groupSnap.exists ? groupSnap.data() || {} : {};

    const tpCarryPot = Math.max(0, Number(groupData?.tpBonus ?? 0) || 0);

    const payload = {
      type: "team_prediction",

      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: FieldValue.serverTimestamp(),

      groupId,
      league: "NHL",

      gameId,
      gameYmd: todayYmd,
      gameStartTimeUTC: Timestamp.fromDate(startDate),
      expiresAt: Timestamp.fromDate(expiresAtDate),
      lockedAt: Timestamp.fromDate(lockedAtDate),

      awayAbbr,
      homeAbbr,

      stakePoints: TP_STAKE_POINTS,
      participantsCount: 0,

      status: "open",

      jackpotCarryIn: tpCarryPot,
      jackpotBumpApplied: false,
      jackpotBumpAppliedAt: null,
      jackpotBumpReason: null,

      payoutApplied: false,
      payoutAppliedAt: null,
      payoutAppliedReason: null,
      payoutTotal: 0,
      bonusUsed: 0,

      decidedAt: null,

      winnersCount: 0,
      winnersPreviewUids: [],
      winnerShares: {},

      officialResult: {
        winnerAbbr: null,
        awayScore: null,
        homeScore: null,
        outcome: null, // REG | OT | TB
        confirmedAt: null,
      },

      resultMessage: null,
    };

    await challengeRef.set(payload, { merge: true });

    logger.info("[createTeamPredictionChallenge] success", {
      challengeId,
      groupId,
      gameId,
      awayAbbr,
      homeAbbr,
      tpCarryPot,
    });

    return {
      ok: true,
      challengeId,
      groupId,
      gameId,
      gameYmd: todayYmd,
      awayAbbr,
      homeAbbr,
      lockedAtISO: lockedAtDate.toISOString(),
      stakePoints: TP_STAKE_POINTS,
      jackpotCarryIn: tpCarryPot,
    };
  }
);