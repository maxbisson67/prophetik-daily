import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils.js";
import { handleMlbGamePostponed } from "./mlbPostponedGameHandler.js";

/** Déclenchement manuel quand un match MLB passe officiellement en Postponed. */
export const voidMlbPostponedChallenges = onCall(async (req) => {
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }

  const gamePk = String(req.data?.gamePk || "").trim();
  if (!gamePk) {
    throw new HttpsError("invalid-argument", "gamePk requis.");
  }

  const ymd =
    typeof req.data?.ymd === "string" && req.data.ymd.length >= 8
      ? req.data.ymd.slice(0, 10)
      : null;

  const result = await handleMlbGamePostponed({
    db,
    gamePk,
    ymd,
    source: "callable",
    force: req.data?.force === true,
  });

  return result;
});
