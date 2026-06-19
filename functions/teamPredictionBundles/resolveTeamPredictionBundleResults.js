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
} from "../teamPredictionChallenges/tpGameSources.js";
import {
  computeBundleStatus,
  refreshSlotStatuses,
} from "./tpBundleUtils.js";
import { applySlotPayoutForBundle } from "./tpBundlePayoutService.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "us-central1";

async function resolveSlotOfficialResult(slot, league) {
  const gameId = String(slot.gameId || "");

  if (normalizeLeague(league) === "MLB") {
    const liveFeed = await fetchMlbLiveFeed(gameId);
    if (!isMlbLiveGameFinal(liveFeed)) return null;
    return extractMlbOfficialResult(liveFeed, slot);
  }

  const gameSnap = await db.doc(`nhl_live_games/${gameId}`).get();
  if (!gameSnap.exists) return null;

  const game = gameSnap.data() || {};
  if (!isNhlLiveGameFinal(game)) return null;

  return extractNhlOfficialResult(game, slot);
}

export const resolveTeamPredictionBundleResults = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/Toronto",
    region: REGION,
  },
  async () => {
    logger.info("[TP bundle resolve] tick");

    const snap = await db
      .collection("team_prediction_bundles")
      .where("status", "in", ["open", "partial", "locked"])
      .limit(50)
      .get();

    if (snap.empty) return;

    for (const doc of snap.docs) {
      const bundleRef = doc.ref;
      const bundle = doc.data() || {};
      const league = normalizeLeague(bundle.league);

      let games = refreshSlotStatuses(bundle.games || []);
      let changed = false;

      for (let i = 0; i < games.length; i += 1) {
        const slot = games[i];
        const slotStatus = String(slot.status || "open").toLowerCase();

        if (slotStatus === "decided") continue;

        try {
          const officialResult = await resolveSlotOfficialResult(slot, league);

          if (
            !officialResult?.winnerAbbr ||
            officialResult.awayScore == null ||
            officialResult.homeScore == null ||
            !officialResult.outcome
          ) {
            continue;
          }

          games[i] = {
            ...slot,
            status: "decided",
            officialResult: {
              winnerAbbr: officialResult.winnerAbbr,
              awayScore: officialResult.awayScore,
              homeScore: officialResult.homeScore,
              outcome: officialResult.outcome,
              confirmedAt: FieldValue.serverTimestamp(),
            },
          };
          changed = true;

          logger.info("[TP bundle resolve] slot decided", {
            bundleId: doc.id,
            gameId: slot.gameId,
            league,
            winnerAbbr: officialResult.winnerAbbr,
          });
        } catch (e) {
          logger.error("[TP bundle resolve] slot error", {
            bundleId: doc.id,
            gameId: slot.gameId,
            err: String(e?.message || e),
          });
        }
      }

      if (!changed) {
        const refreshed = refreshSlotStatuses(bundle.games || []);
        const nextStatus = computeBundleStatus(refreshed);
        if (nextStatus !== bundle.status || JSON.stringify(refreshed) !== JSON.stringify(bundle.games)) {
          await bundleRef.set(
            {
              games: refreshed,
              status: nextStatus,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        continue;
      }

      const nextStatus = computeBundleStatus(games);
      const allDecided = nextStatus === "decided";

      await bundleRef.set(
        {
          games,
          status: nextStatus,
          ...(allDecided ? { decidedAt: FieldValue.serverTimestamp() } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      for (const slot of games) {
        if (String(slot.status || "").toLowerCase() !== "decided") continue;
        if (slot.payoutApplied) continue;

        try {
          await applySlotPayoutForBundle({
            bundleId: doc.id,
            gameId: String(slot.gameId),
          });
        } catch (e) {
          logger.error("[TP bundle resolve] payout error", {
            bundleId: doc.id,
            gameId: slot.gameId,
            err: String(e?.message || e),
          });
        }
      }
    }
  }
);
