import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  extractMlbOfficialResult,
  extractNhlOfficialResult,
  fetchMlbLiveFeed,
  isMlbLiveGameFinal,
  isNhlLiveGameFinal,
  normalizeLeague,
} from "./tpGameSources.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";

export const resolveTeamPredictionResults = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/Toronto",
    region: REGION,
  },
  async () => {
    logger.info("[TP resolve] tick");

    const snap = await db
      .collection("team_prediction_challenges")
      .where("status", "in", ["open", "locked"])
      .limit(100)
      .get();

    if (snap.empty) return;

    for (const doc of snap.docs) {
      const chRef = doc.ref;
      const ch = doc.data() || {};

      const gameId = String(ch.gameId || "");
      const league = normalizeLeague(ch.league);

      if (!gameId) {
        logger.info("[TP resolve] skip missing gameId", {
          challengeId: doc.id,
          gameId,
        });
        continue;
      }

      try {
        let officialResult = null;

        if (league === "MLB") {
          const liveFeed = await fetchMlbLiveFeed(gameId);

          if (!isMlbLiveGameFinal(liveFeed)) {
            logger.info("[TP resolve] skip MLB not final", {
              challengeId: doc.id,
              gameId,
              abstractGameState: liveFeed?.gameData?.status?.abstractGameState ?? null,
            });
            continue;
          }

          officialResult = extractMlbOfficialResult(liveFeed, ch);
        } else {
          const gameSnap = await db.doc(`nhl_live_games/${gameId}`).get();

          if (!gameSnap.exists) {
            logger.info("[TP resolve] skip missing live game", {
              challengeId: doc.id,
              gameId,
            });
            continue;
          }

          const game = gameSnap.data() || {};

          if (!isNhlLiveGameFinal(game)) {
            logger.info("[TP resolve] skip NHL not final", {
              challengeId: doc.id,
              gameId,
              isFinal: game?.isFinal ?? null,
              state: game?.state ?? null,
              gameState: game?.gameState ?? null,
              gameStatus: game?.gameStatus ?? null,
            });
            continue;
          }

          officialResult = extractNhlOfficialResult(game, ch);
        }

        if (
          !officialResult?.winnerAbbr ||
          officialResult.awayScore == null ||
          officialResult.homeScore == null ||
          !officialResult.outcome
        ) {
          logger.info("[TP resolve] skip incomplete official result", {
            challengeId: doc.id,
            gameId,
            league,
            officialResult,
          });
          continue;
        }

        await chRef.set(
          {
            status: "decided",
            decidedAt: FieldValue.serverTimestamp(),
            officialResult: {
              winnerAbbr: officialResult.winnerAbbr,
              awayScore: officialResult.awayScore,
              homeScore: officialResult.homeScore,
              outcome: officialResult.outcome,
              confirmedAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        logger.info("[TP resolve] decided", {
          challengeId: doc.id,
          gameId,
          league,
          winnerAbbr: officialResult.winnerAbbr,
          awayScore: officialResult.awayScore,
          homeScore: officialResult.homeScore,
          outcome: officialResult.outcome,
        });
      } catch (e) {
        logger.error("[TP resolve] error", {
          challengeId: doc.id,
          league,
          err: String(e?.message || e),
        });
      }
    }
  }
);
