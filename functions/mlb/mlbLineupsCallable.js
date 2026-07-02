import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveMlbGameLineups } from "./mlbGameLineups.js";

function str(v) {
  return String(v ?? "").trim();
}

/**
 * Alignements du jour (ordre de frappe 1–9) pour un gamePk MLB.
 */
export const prefetchMlbLineups = onCall({ region: "us-central1" }, async (req) => {
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Auth requise.");
  }

  const gamePk = str(req.data?.gamePk || req.data?.gameId);
  if (!gamePk) {
    throw new HttpsError("invalid-argument", "gamePk requis.");
  }

  const lineups = await resolveMlbGameLineups(gamePk);

  return {
    ok: true,
    gamePk,
    away: lineups.away || {},
    home: lineups.home || {},
    hasLineups: lineups.hasLineups === true,
    source: lineups.source || null,
  };
});
