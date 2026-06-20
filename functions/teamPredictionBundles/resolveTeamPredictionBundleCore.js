import { FieldValue, Timestamp } from "firebase-admin/firestore";
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

const BATCH_SIZE = 100;

function isOfficialResultComplete(officialResult) {
  return (
    !!officialResult?.winnerAbbr &&
    officialResult.awayScore != null &&
    officialResult.homeScore != null &&
    !!officialResult.outcome
  );
}

async function resolveSlotOfficialResult(db, slot, league) {
  const gameId = String(slot.gameId || "");

  if (normalizeLeague(league) === "MLB") {
    const liveFeed = await fetchMlbLiveFeed(gameId);
    if (!isMlbLiveGameFinal(liveFeed)) {
      return {
        ok: false,
        reason: "mlb-not-final",
        abstractGameState: liveFeed?.gameData?.status?.abstractGameState ?? null,
      };
    }

    const officialResult = extractMlbOfficialResult(liveFeed, slot);
    return { ok: true, officialResult };
  }

  const gameSnap = await db.doc(`nhl_live_games/${gameId}`).get();
  if (!gameSnap.exists) {
    return { ok: false, reason: "nhl-live-missing" };
  }

  const game = gameSnap.data() || {};
  if (!isNhlLiveGameFinal(game)) {
    return {
      ok: false,
      reason: "nhl-not-final",
      gameState: game?.gameState ?? null,
    };
  }

  return { ok: true, officialResult: extractNhlOfficialResult(game, slot) };
}

async function applyPayoutsForDecidedSlots(bundleId, games) {
  for (const slot of games) {
    if (String(slot.status || "").toLowerCase() !== "decided") continue;
    if (slot.payoutApplied) continue;

    try {
      await applySlotPayoutForBundle({
        bundleId,
        gameId: String(slot.gameId),
      });
    } catch (e) {
      logger.error("[TP bundle resolve] payout error", {
        bundleId,
        gameId: slot.gameId,
        err: String(e?.message || e),
      });
    }
  }
}

export async function resolveTeamPredictionBundleDoc({ db, doc }) {
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
      const resolved = await resolveSlotOfficialResult(db, slot, league);

      if (!resolved.ok) {
        logger.info("[TP bundle resolve] slot pending", {
          bundleId: doc.id,
          gameId: slot.gameId,
          league,
          reason: resolved.reason,
          ...(resolved.abstractGameState != null
            ? { abstractGameState: resolved.abstractGameState }
            : {}),
          ...(resolved.gameState != null ? { gameState: resolved.gameState } : {}),
        });
        continue;
      }

      const { officialResult } = resolved;

      if (!isOfficialResultComplete(officialResult)) {
        logger.info("[TP bundle resolve] slot incomplete result", {
          bundleId: doc.id,
          gameId: slot.gameId,
          league,
          officialResult,
        });
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
          confirmedAt: Timestamp.now(),
        },
      };
      changed = true;

      logger.info("[TP bundle resolve] slot decided", {
        bundleId: doc.id,
        gameId: slot.gameId,
        league,
        winnerAbbr: officialResult.winnerAbbr,
        awayScore: officialResult.awayScore,
        homeScore: officialResult.homeScore,
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

    if (
      nextStatus !== bundle.status ||
      JSON.stringify(refreshed) !== JSON.stringify(bundle.games)
    ) {
      await bundleRef.set(
        {
          games: refreshed,
          status: nextStatus,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return { bundleId: doc.id, changed: false, status: nextStatus };
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

  await applyPayoutsForDecidedSlots(doc.id, games);

  return {
    bundleId: doc.id,
    changed: true,
    status: nextStatus,
    decidedSlots: games.filter((g) => String(g.status).toLowerCase() === "decided").length,
  };
}

export async function resolveTeamPredictionBundles({ db, bundleId = null } = {}) {
  const results = [];

  if (bundleId) {
    const snap = await db.doc(`team_prediction_bundles/${bundleId}`).get();
    if (!snap.exists) {
      return { ok: false, reason: "bundle-not-found", bundleId };
    }

    const result = await resolveTeamPredictionBundleDoc({ db, doc: snap });
    return { ok: true, processed: 1, results: [result] };
  }

  let lastDoc = null;

  while (true) {
    let query = db
      .collection("team_prediction_bundles")
      .where("status", "in", ["open", "partial", "locked"])
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      results.push(await resolveTeamPredictionBundleDoc({ db, doc }));
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  const changedCount = results.filter((r) => r.changed).length;

  return {
    ok: true,
    processed: results.length,
    changedCount,
    results,
  };
}
