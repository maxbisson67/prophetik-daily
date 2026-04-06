import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function isGameFinal(game) {
  const s1 = safeUpper(game?.gameState);
  const s2 = safeUpper(game?.gameStatus);
  const s3 = safeUpper(game?.state);

  return (
    game?.isFinal === true ||
    s1.includes("FINAL") ||
    s2.includes("FINAL") ||
    s3.includes("FINAL") ||
    s1 === "OFF" ||
    s2 === "OFF" ||
    s3 === "OFF" ||
    s1 === "OFFICIAL" ||
    s2 === "OFFICIAL" ||
    s3 === "OFFICIAL"
  );
}

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
      const ch = doc.data();

      const gameId = String(ch.gameId || "");
      const gameYmd = String(ch.gameYmd || "");

      if (!gameId || !gameYmd) {
        logger.info("[TP resolve] skip missing game refs", {
          challengeId: doc.id,
          gameId,
          gameYmd,
        });
        continue;
      }

      try {
        const gameSnap = await db.doc(`nhl_live_games/${gameId}`).get();

        if (!gameSnap.exists) {
          logger.info("[TP resolve] skip missing live game", {
            challengeId: doc.id,
            gameId,
          });
          continue;
        }

        const game = gameSnap.data() || {};

        if (!isGameFinal(game)) {
          logger.info("[TP resolve] skip not final", {
            challengeId: doc.id,
            gameId,
            isFinal: game?.isFinal ?? null,
            state: game?.state ?? null,
            gameState: game?.gameState ?? null,
            gameStatus: game?.gameStatus ?? null,
          });
          continue;
        }

        const awayScore = Number(game.awayScore ?? game.away?.score ?? 0);
        const homeScore = Number(game.homeScore ?? game.home?.score ?? 0);

        const winnerAbbr = awayScore > homeScore ? ch.awayAbbr : ch.homeAbbr;

        let outcome = "REG";
        if (game.periodType === "OT") outcome = "OT";
        if (game.periodType === "SO") outcome = "TB";

        await chRef.set(
          {
            status: "decided",
            decidedAt: FieldValue.serverTimestamp(),
            officialResult: {
              winnerAbbr,
              awayScore,
              homeScore,
              outcome,
              confirmedAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        logger.info("[TP resolve] decided", {
          challengeId: doc.id,
          gameId,
          winnerAbbr,
          awayScore,
          homeScore,
          outcome,
        });
      } catch (e) {
        logger.error("[TP resolve] error", {
          challengeId: doc.id,
          err: String(e?.message || e),
        });
      }
    }
  }
);