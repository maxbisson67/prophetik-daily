import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "../utils.js";
import { repairFirstGoalGame } from "./repairFirstGoalGame.js";

const REGION = "us-central1";

export const repairFirstGoalGameCallable = onCall(
  { region: REGION },
  async (request) => {
    try {
      logger.info("[FG-M] callable start", { data: request.data || null });

      const gameId = String(request.data?.gameId || "").trim();

      if (!gameId) {
        throw new HttpsError("invalid-argument", "gameId manquant");
      }

      const res = await repairFirstGoalGame(gameId, request.data || {});
      logger.info("[FG-M] callable success", { gameId, res });

      return res;
    } catch (e) {
      logger.error("[FG-M] repairFirstGoalGameCallable failed", {
        message: e?.message || String(e),
        stack: e?.stack || null,
      });

      if (e instanceof HttpsError) throw e;
      throw new HttpsError("internal", e?.message || "Erreur interne");
    }
  }
);