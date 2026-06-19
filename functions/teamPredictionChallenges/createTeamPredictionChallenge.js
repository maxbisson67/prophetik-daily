import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  TP_DEFAULT_SCORING,
  pickString,
  normalizeLeague,
  ymdFromDate,
  findExistingTeamPredictionChallenge,
  isActiveChallengeStatus,
  loadNhlScheduleGame,
  loadMlbScheduleGame,
} from "./tpGameSources.js";
import { buildEmptyMlbPitcher } from "../mlb/mlbProbablePitchers.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

const TP_STAKE_POINTS = 2;
const TP_LOCK_BEFORE_MINUTES = 5;
const TP_EXPIRES_AFTER_DAYS = 2;

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
    const league = normalizeLeague(req.data?.league);

    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId requis.");
    }

    if (!gameId) {
      throw new HttpsError("invalid-argument", "gameId requis.");
    }

    logger.info("[createTeamPredictionChallenge] start", { uid, groupId, gameId, league });

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

    let gameData = null;

    if (league === "MLB") {
      gameData = await loadMlbScheduleGame(db, { gameId, todayYmd });
    } else {
      gameData = await loadNhlScheduleGame(db, { gameId, todayYmd });
    }

    if (!gameData?.ok) {
      if (gameData?.reason === "not-found") {
        const collection =
          league === "MLB" ? "mlb_schedule_daily" : "nhl_schedule_daily";
        throw new HttpsError(
          "not-found",
          `Match introuvable dans ${collection}/${todayYmd}/games/${gameId}.`
        );
      }

      if (gameData?.reason === "game-finished") {
        throw new HttpsError(
          "failed-precondition",
          "Impossible de créer un TP sur un match déjà terminé."
        );
      }

      throw new HttpsError(
        "failed-precondition",
        "Les données du match sont incomplètes (away/home/startTimeUTC)."
      );
    }

    const { awayAbbr, homeAbbr, startDate, gameYmd } = gameData;

    const lockedAtDate = new Date(startDate.getTime() - TP_LOCK_BEFORE_MINUTES * 60 * 1000);
    const expiresAtDate = addDays(new Date(), TP_EXPIRES_AFTER_DAYS);

    if (Date.now() >= lockedAtDate.getTime()) {
      throw new HttpsError(
        "failed-precondition",
        "Impossible de créer un TP moins de 5 minutes avant le début du match."
      );
    }

    const { challengeRef, challengeSnap, challengeId } =
      await findExistingTeamPredictionChallenge(db, { league, groupId, gameId });

    if (challengeSnap.exists) {
      const existing = challengeSnap.data() || {};
      const status = String(existing.status || "").toLowerCase();

      if (isActiveChallengeStatus(status)) {
        throw new HttpsError(
          "already-exists",
          "Un défi TP existe déjà pour ce match dans ce groupe."
        );
      }
    }

    const payload = {
      type: "team_prediction",

      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: FieldValue.serverTimestamp(),

      groupId,
      league,

      gameId,
      gameYmd,
      gameStartTimeUTC: Timestamp.fromDate(startDate),
      expiresAt: Timestamp.fromDate(expiresAtDate),
      lockedAt: Timestamp.fromDate(lockedAtDate),

      awayAbbr,
      homeAbbr,

      ...(league === "MLB"
        ? {
            homeProbablePitcher: gameData.homeProbablePitcher || buildEmptyMlbPitcher(),
            awayProbablePitcher: gameData.awayProbablePitcher || buildEmptyMlbPitcher(),
          }
        : {}),

      stakePoints: TP_STAKE_POINTS,
      participantsCount: 0,

      status: "open",

      scoring: { ...TP_DEFAULT_SCORING },

      payoutApplied: false,
      payoutAppliedAt: null,
      payoutAppliedReason: null,
      payoutTotal: 0,

      decidedAt: null,

      winnersCount: 0,
      winnersPreviewUids: [],

      officialResult: {
        winnerAbbr: null,
        awayScore: null,
        homeScore: null,
        outcome: null,
        confirmedAt: null,
      },

      resultMessage: null,
    };

    await challengeRef.set(payload, { merge: true });

    logger.info("[createTeamPredictionChallenge] success", {
      challengeId,
      groupId,
      gameId,
      league,
      awayAbbr,
      homeAbbr,
    });

    return {
      ok: true,
      challengeId,
      groupId,
      gameId,
      league,
      gameYmd,
      awayAbbr,
      homeAbbr,
      lockedAtISO: lockedAtDate.toISOString(),
      stakePoints: TP_STAKE_POINTS,
    };
  }
);
