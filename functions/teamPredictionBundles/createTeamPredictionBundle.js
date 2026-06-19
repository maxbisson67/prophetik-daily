import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { normalizeLeague, pickString } from "../teamPredictionChallenges/tpGameSources.js";
import {
  buildTeamPredictionBundleId,
  defaultBundlePayload,
  ymdFromBusinessDate,
} from "./tpBundleUtils.js";
import {
  buildBundleGamesFromSelection,
  loadEligibleScheduleGames,
  previewBundleSelection,
  selectGamesForTpBundle,
} from "./tpBundleGameSelection.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

function isOwnerRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

export const createTeamPredictionBundle = onCall(
  { region: "us-central1", timeoutSeconds: 60, memory: "512MiB" },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Auth requise.");
    }

    const groupId = pickString(req.data?.groupId);
    const league = normalizeLeague(req.data?.league);
    const previewOnly = req.data?.previewOnly === true;

    if (!groupId) {
      throw new HttpsError("invalid-argument", "groupId requis.");
    }

    const groupSnap = await db.doc(`groups/${groupId}`).get();
    if (!groupSnap.exists) {
      throw new HttpsError("not-found", "Groupe introuvable.");
    }

    const group = groupSnap.data() || {};
    const groupSport = normalizeLeague(group.sport || group.league || league);

    if (groupSport !== league) {
      throw new HttpsError(
        "failed-precondition",
        "La ligue du défi doit correspondre au sport du groupe."
      );
    }

    const membershipSnap = await db.doc(`group_memberships/${groupId}_${uid}`).get();
    if (!membershipSnap.exists) {
      throw new HttpsError("permission-denied", "Tu n'es pas membre de ce groupe.");
    }

    const membership = membershipSnap.data() || {};
    if (!isOwnerRole(membership.role)) {
      throw new HttpsError("permission-denied", "Seul le owner/admin peut créer un défi TP.");
    }

    const gameYmd = ymdFromBusinessDate(new Date());
    const eligibleGames = await loadEligibleScheduleGames(db, { league, gameYmd });

    if (previewOnly) {
      const preview = previewBundleSelection({
        games: eligibleGames,
        group,
        league,
      });

      return {
        ok: true,
        preview: true,
        groupId,
        league,
        gameYmd,
        ...preview,
      };
    }

    const bundleId = buildTeamPredictionBundleId({ league, groupId, gameYmd });
    const bundleRef = db.doc(`team_prediction_bundles/${bundleId}`);
    const existingSnap = await bundleRef.get();

    if (existingSnap.exists) {
      throw new HttpsError(
        "already-exists",
        "Un défi TP existe déjà pour ce groupe aujourd'hui."
      );
    }

    const { games: selectedGames, gameCount } = selectGamesForTpBundle({
      games: eligibleGames,
      group,
      league,
    });

    if (gameCount < 1) {
      throw new HttpsError(
        "failed-precondition",
        "Aucun match éligible pour créer un défi TP aujourd'hui."
      );
    }

    const games = buildBundleGamesFromSelection(selectedGames, league);
    const favoriteTeam = group.favoriteTeam || null;

    const payload = {
      ...defaultBundlePayload({
        groupId,
        league,
        gameYmd,
        games,
        createdBy: uid,
        favoriteTeamSnapshot: favoriteTeam,
        autopilotCreated: false,
      }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await bundleRef.set(payload, { merge: false });

    logger.info("[createTeamPredictionBundle] success", {
      bundleId,
      groupId,
      league,
      gameYmd,
      gameCount,
      gameIds: games.map((g) => g.gameId),
    });

    return {
      ok: true,
      bundleId,
      groupId,
      league,
      gameYmd,
      gameCount,
      games: games.map((g) => ({
        slot: g.slot,
        gameId: g.gameId,
        awayAbbr: g.awayAbbr,
        homeAbbr: g.homeAbbr,
        isFavoriteGame: g.isFavoriteGame,
      })),
    };
  }
);
