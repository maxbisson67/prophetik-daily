// functions/mlb/mlbInjuriesSync.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";
import { FieldPath } from "firebase-admin/firestore";
import { fetchAllMLBInjuriesFromESPN, normalizeESPNStatus } from "../utils/espnApi.js";
import { findBestMatch, logMatchingResults } from "../utils/nameMatching.js";

const BATCH_MAX = 450;

function ymdUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cleanUndefined(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => cleanUndefined(item));

  const cleaned = {};
  for (const key in obj) {
    const value = obj[key];
    if (value !== undefined) cleaned[key] = cleanUndefined(value);
  }
  return cleaned;
}

async function getAllMlbPlayersFromFirestore() {
  const players = [];
  let lastDoc = null;
  let pageCount = 0;

  logger.info("[MLB Injuries] Loading all MLB players from Firestore...");

  while (true) {
    let query = db
      .collection("mlb_players")
      .where("active", "==", true)
      .orderBy(FieldPath.documentId())
      .limit(500);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    pageCount++;
    snapshot.forEach((doc) => {
      players.push({
        playerId: doc.id,
        ...doc.data(),
      });
    });

    logger.info(`[MLB Injuries] Loaded page ${pageCount}`, {
      count: snapshot.size,
      total: players.length,
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < 500) break;
  }

  logger.info("[MLB Injuries] All MLB players loaded", {
    total: players.length,
    pages: pageCount,
  });

  return players;
}

function mapInjuryToPlayerFormat(espnInjury) {
  return cleanUndefined({
    status: normalizeESPNStatus(espnInjury.strStatus),
    short: espnInjury.strInjury || null,
    description: espnInjury.description || null,
    startDate: null,
    expectedReturn: null,
    updatedDate: espnInjury.dateUpdated || null,
    source: "espn",
    espnData: {
      playerName: espnInjury.playerName || null,
      team: espnInjury.teamName || null,
      espnPlayerId: espnInjury.espnPlayerId || null,
      rawStatus: espnInjury.strStatus || null,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function clearStaleInjuries(runId, injuredPlayerIds) {
  let cleared = 0;
  let lastDoc = null;
  let scanned = 0;

  logger.info("[MLB Injuries] Clearing stale injuries...");

  while (true) {
    let query = db
      .collection("mlb_players")
      .where("injury.source", "==", "espn")
      .orderBy(FieldPath.documentId())
      .limit(400);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    scanned += snapshot.size;

    let batch = db.batch();
    let batchCount = 0;

    snapshot.forEach((doc) => {
      if (!injuredPlayerIds.has(doc.id)) {
        batch.set(
          doc.ref,
          {
            injury: FieldValue.delete(),
            injuryClearedAt: FieldValue.serverTimestamp(),
            injuryClearReason: "not_in_espn_anymore",
            injuryMappingRunId: runId,
          },
          { merge: true }
        );
        batchCount++;
        cleared++;
      }
    });

    if (batchCount > 0) await batch.commit();

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < 400) break;
  }

  logger.info("[MLB Injuries] Stale injuries cleared", { scanned, cleared });
  return cleared;
}

async function runSyncMlbInjuries() {
  const runId = String(Date.now());
  const runYmd = ymdUTC(new Date());
  const startedAt = Date.now();

  logger.info("[MLB Injuries] Sync start (ESPN API)", { runId, runYmd });

  try {
    const espnInjuries = await fetchAllMLBInjuriesFromESPN();

    logger.info("[MLB Injuries] Fetched from ESPN", {
      count: espnInjuries.length,
      apiRequestsUsed: 1,
    });

    if (espnInjuries.length === 0) {
      logger.warn("[MLB Injuries] No injuries returned from ESPN");
    }

    const mlbPlayers = await getAllMlbPlayersFromFirestore();

    if (mlbPlayers.length === 0) {
      logger.error("[MLB Injuries] No MLB players found. Run refreshMlbPlayers first!");
      return { ok: false, error: "No MLB players in Firestore" };
    }

    logger.info("[MLB Injuries] Starting matching process...");

    const matches = [];
    const injuredPlayerIds = new Set();
    const matchStats = {
      total: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      notMatched: espnInjuries.length,
    };

    for (const mlbPlayer of mlbPlayers) {
      const matchResult = findBestMatch(mlbPlayer, espnInjuries, 80);

      if (matchResult) {
        matches.push({
          playerId: mlbPlayer.playerId,
          mlbPlayer,
          injury: matchResult.match,
          matchScore: matchResult.score,
          confidence: matchResult.confidence,
        });

        injuredPlayerIds.add(String(mlbPlayer.playerId));

        matchStats.total++;
        matchStats.notMatched--;

        if (matchResult.confidence === "high") matchStats.highConfidence++;
        else if (matchResult.confidence === "medium") matchStats.mediumConfidence++;
      }
    }

    logger.info("[MLB Injuries] Matching completed", {
      totalMlbPlayers: mlbPlayers.length,
      totalESPNInjuries: espnInjuries.length,
      matchesFound: matches.length,
      ...matchStats,
    });

    if (matches.length > 0) {
      logMatchingResults(
        matches.slice(0, 10).map((m) => ({
          nhlPlayerId: m.playerId,
          nhlName: m.mlbPlayer.fullName,
          sportsDbName: m.injury.strPlayer,
          teamAbbrev: m.mlbPlayer.teamAbbr,
          score: m.matchScore,
          confidence: m.confidence,
          injury: m.injury,
        }))
      );
    }

    logger.info("[MLB Injuries] Upserting injuries to Firestore...");

    let batch = db.batch();
    let batchCount = 0;
    let upsertedCount = 0;

    for (const match of matches) {
      const ref = db.collection("mlb_players").doc(String(match.playerId));
      const injuryData = mapInjuryToPlayerFormat(match.injury);

      batch.set(
        ref,
        cleanUndefined({
          injury: injuryData,
          injuryMappingRunId: runId,
          injuryMatchScore: match.matchScore,
          injuryMatchConfidence: match.confidence,
          injuryLastMapped: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );

      batchCount++;
      upsertedCount++;

      if (batchCount >= BATCH_MAX) {
        await batch.commit();
        logger.info(`[MLB Injuries] Batch committed (${upsertedCount} so far)`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();

    logger.info("[MLB Injuries] Injuries upserted", { count: upsertedCount });

    const clearedCount = await clearStaleInjuries(runId, injuredPlayerIds);
    const duration = Date.now() - startedAt;

    await db.collection("_jobs").doc("syncMlbInjuries").set(
      {
        ok: true,
        runId,
        runYmd,
        mlbPlayersTotal: mlbPlayers.length,
        espnInjuriesTotal: espnInjuries.length,
        matchesFound: matches.length,
        injuriesUpserted: upsertedCount,
        injuriesCleared: clearedCount,
        matchStats,
        apiRequestsUsed: 1,
        durationMs: duration,
        ranAt: FieldValue.serverTimestamp(),
        source: "mlbInjuriesSync.js (ESPN)",
      },
      { merge: true }
    );

    logger.info("[MLB Injuries] Sync completed successfully", {
      runId,
      mlbPlayersTotal: mlbPlayers.length,
      espnInjuriesTotal: espnInjuries.length,
      matchesFound: matches.length,
      injuriesUpserted: upsertedCount,
      injuriesCleared: clearedCount,
      durationMs: duration,
    });

    return {
      ok: true,
      runId,
      mlbPlayersTotal: mlbPlayers.length,
      espnInjuriesTotal: espnInjuries.length,
      matchesFound: matches.length,
      injuriesUpserted: upsertedCount,
      injuriesCleared: clearedCount,
      apiRequestsUsed: 1,
      durationMs: duration,
    };
  } catch (error) {
    logger.error("[MLB Injuries] Sync failed", {
      error: error.message,
      stack: error.stack,
    });

    await db.collection("_jobs").doc("syncMlbInjuries").set(
      {
        ok: false,
        error: error.message,
        runId,
        ranAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    throw error;
  }
}

export const syncMlbInjuries = onSchedule(
  {
    schedule: "30 12 * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async () => {
    await runSyncMlbInjuries();
  }
);

export const syncMlbInjuriesManual = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    return await runSyncMlbInjuries();
  }
);
