/**
 * Invalide le cache BvP (`mlb_bvp`) quand un match MLB passe Final —
 * les stats carrière vsPlayerTotal incluent alors les nouvelles confrontations.
 */

import { db, FieldValue, logger } from "../utils.js";
import { bvpDocId, MLB_BVP_COLLECTION } from "./mlbBvpStats.js";

export const MLB_BVP_INVALIDATION_LOG = "mlb_bvp_invalidation_log";

const DELETE_BATCH_SIZE = 400;

function str(v) {
  return String(v ?? "").trim();
}

function safeUpper(v) {
  return str(v).toUpperCase();
}

function addPitcherId(set, id) {
  const pid = str(id);
  if (pid) set.add(pid);
}

function extractPitcherIdsForInvalidation(scheduleGame = {}, liveFeed = null) {
  const homePitcherIds = new Set();
  const awayPitcherIds = new Set();

  addPitcherId(homePitcherIds, scheduleGame?.homeProbablePitcher?.id);
  addPitcherId(awayPitcherIds, scheduleGame?.awayProbablePitcher?.id);

  const boxTeams = liveFeed?.liveData?.boxscore?.teams || {};
  for (const side of ["away", "home"]) {
    const pitchers = Array.isArray(boxTeams?.[side]?.pitchers) ? boxTeams[side].pitchers : [];
    const firstPitcherId = pitchers[0];
    if (side === "home") addPitcherId(homePitcherIds, firstPitcherId);
    else addPitcherId(awayPitcherIds, firstPitcherId);
  }

  return {
    homePitcherIds: [...homePitcherIds],
    awayPitcherIds: [...awayPitcherIds],
  };
}

async function loadActiveMlbBatterIdsByTeam(teamAbbr) {
  const abbr = safeUpper(teamAbbr);
  if (!abbr) return [];

  const snap = await db
    .collection("mlb_players")
    .where("teamAbbr", "==", abbr)
    .where("active", "==", true)
    .get();

  const ids = new Set();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const pid = str(data.playerId || docSnap.id);
    if (!pid) continue;
    if (safeUpper(data.positionCode) === "P") continue;
    ids.add(pid);
  }

  return [...ids];
}

function buildInvalidationPlan(scheduleGame = {}, liveFeed = null) {
  const awayAbbr = safeUpper(
    scheduleGame?.awayTeam?.abbreviation || scheduleGame?.awayAbbr
  );
  const homeAbbr = safeUpper(
    scheduleGame?.homeTeam?.abbreviation || scheduleGame?.homeAbbr
  );

  const { homePitcherIds, awayPitcherIds } = extractPitcherIdsForInvalidation(
    scheduleGame,
    liveFeed
  );

  return { awayAbbr, homeAbbr, homePitcherIds, awayPitcherIds };
}

async function buildInvalidationPairs(scheduleGame = {}, liveFeed = null) {
  const { awayAbbr, homeAbbr, homePitcherIds, awayPitcherIds } = buildInvalidationPlan(
    scheduleGame,
    liveFeed
  );
  const pairs = [];
  const seen = new Set();

  const pushPair = (batterId, pitcherId) => {
    const bid = str(batterId);
    const pid = str(pitcherId);
    if (!bid || !pid) return;
    const key = bvpDocId(bid, pid);
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ batterId: bid, pitcherId: pid });
  };

  if (awayAbbr && homePitcherIds.length) {
    const awayBatters = await loadActiveMlbBatterIdsByTeam(awayAbbr);
    for (const batterId of awayBatters) {
      for (const pitcherId of homePitcherIds) {
        pushPair(batterId, pitcherId);
      }
    }
  }

  if (homeAbbr && awayPitcherIds.length) {
    const homeBatters = await loadActiveMlbBatterIdsByTeam(homeAbbr);
    for (const batterId of homeBatters) {
      for (const pitcherId of awayPitcherIds) {
        pushPair(batterId, pitcherId);
      }
    }
  }

  return pairs;
}

async function deleteBvpPairs(pairs = []) {
  if (!pairs.length) return 0;

  let deleted = 0;

  for (let i = 0; i < pairs.length; i += DELETE_BATCH_SIZE) {
    const chunk = pairs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = db.batch();

    for (const pair of chunk) {
      batch.delete(db.collection(MLB_BVP_COLLECTION).doc(bvpDocId(pair.batterId, pair.pitcherId)));
    }

    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

/**
 * Supprime les entrées cache BvP pour les frappeurs des deux équipes vs leurs lanceurs adverses.
 * Idempotent via `mlb_bvp_invalidation_log/{gamePk}`.
 */
export async function invalidateMlbBvpCacheForFinalGame(scheduleGame = {}, options = {}) {
  const gamePk = str(options.gamePk || scheduleGame?.gamePk || scheduleGame?.id);
  const liveFeed = options.liveFeed || null;

  if (!gamePk) {
    return { ok: false, skipped: true, reason: "missing_game_pk", deleted: 0 };
  }

  const markerRef = db.collection(MLB_BVP_INVALIDATION_LOG).doc(gamePk);
  const markerSnap = await markerRef.get();
  if (markerSnap.exists) {
    return {
      ok: true,
      skipped: true,
      reason: "already_invalidated",
      gamePk,
      deleted: 0,
    };
  }

  const plan = buildInvalidationPlan(scheduleGame, liveFeed);
  const { awayAbbr, homeAbbr, homePitcherIds, awayPitcherIds } = plan;

  if (!homePitcherIds.length && !awayPitcherIds.length) {
    await markerRef.set({
      gamePk,
      awayAbbr: awayAbbr || null,
      homeAbbr: homeAbbr || null,
      deleted: 0,
      pairCount: 0,
      reason: "no_pitcher_ids",
      invalidatedAt: FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      skipped: true,
      reason: "no_pitcher_ids",
      gamePk,
      deleted: 0,
    };
  }

  const pairs = await buildInvalidationPairs(scheduleGame, liveFeed);
  const deleted = await deleteBvpPairs(pairs);

  await markerRef.set({
    gamePk,
    awayAbbr: awayAbbr || null,
    homeAbbr: homeAbbr || null,
    homePitcherIds,
    awayPitcherIds,
    pairCount: pairs.length,
    deleted,
    invalidatedAt: FieldValue.serverTimestamp(),
  });

  logger.info("[mlbBvp] invalidated cache for final game", {
    gamePk,
    awayAbbr,
    homeAbbr,
    homePitcherIds,
    awayPitcherIds,
    pairCount: pairs.length,
    deleted,
  });

  return {
    ok: true,
    skipped: false,
    gamePk,
    deleted,
    pairCount: pairs.length,
  };
}
