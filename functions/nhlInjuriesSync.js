 // functions/nhlInjuriesSync.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "./utils.js";
import { FieldPath } from "firebase-admin/firestore";

import { 
  fetchAllNHLInjuriesFromESPN, 
  normalizeESPNStatus 
} from "./utils/espnApi.js";

import { findBestMatch, logMatchingResults } from "./utils/nameMatching.js";

const BATCH_MAX = 450;

function ymdUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Nettoie un objet en remplaçant undefined par null récursivement
 */
function cleanUndefined(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  
  const cleaned = {};
  for (const key in obj) {
    const value = obj[key];
    if (value !== undefined) {
      cleaned[key] = cleanUndefined(value);
    }
  }
  
  return cleaned;
}

/**
 * Récupère TOUS les joueurs NHL actifs depuis Firestore avec pagination
 */
async function getAllNHLPlayersFromFirestore() {
  const players = [];
  let lastDoc = null;
  let pageCount = 0;
  
  logger.info("[Injuries] Loading all NHL players from Firestore...");
  
  while (true) {
    let query = db
      .collection("nhl_players")
      .where("active", "==", true)
      .orderBy(FieldPath.documentId())
      .limit(500);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) break;
    
    pageCount++;
    snapshot.forEach(doc => {
      players.push({
        nhlPlayerId: doc.id,
        ...doc.data()
      });
    });
    
    logger.info(`[Injuries] Loaded page ${pageCount}`, { 
      count: snapshot.size,
      total: players.length 
    });
    
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    if (snapshot.size < 500) break;
  }
  
  logger.info("[Injuries] All NHL players loaded", { 
    total: players.length,
    pages: pageCount 
  });
  
  return players;
}

/**
 * Convertit une blessure ESPN en format standard
 * ✅ Nettoie tous les undefined
 */
function mapInjuryToPlayerFormat(espnInjury) {
  const rawData = {
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
    },
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  // ✅ Nettoyer tous les undefined
  return cleanUndefined(rawData);
}

/**
 * Commit un batch si non vide
 */
async function commitBatch(batch, count) {
  if (count > 0) await batch.commit();
}

/**
 * Clear les blessures des joueurs qui ne sont plus blessés
 */
async function clearStaleInjuries(runId, injuredPlayerIds) {
  let cleared = 0;
  let lastDoc = null;
  let scanned = 0;

  logger.info("[Injuries] Clearing stale injuries...");

  while (true) {
    let query = db
      .collection("nhl_players")
      .where("injury.source", "==", "espn")
      .orderBy(FieldPath.documentId())
      .limit(400);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) break;

    scanned += snapshot.size;

    let batch = db.batch();
    let batchCount = 0;

    snapshot.forEach(doc => {
      const nhlPlayerId = doc.id;
      
      if (!injuredPlayerIds.has(nhlPlayerId)) {
        batch.set(doc.ref, {
          injury: FieldValue.delete(),
          injuryClearedAt: FieldValue.serverTimestamp(),
          injuryClearReason: "not_in_espn_anymore",
          injuryMappingRunId: runId,
        }, { merge: true });
        
        batchCount++;
        cleared++;
      }
    });

    if (batchCount > 0) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    if (snapshot.size < 400) break;
  }

  logger.info("[Injuries] Stale injuries cleared", { 
    scanned, 
    cleared 
  });

  return cleared;
}

/**
 * Fonction principale de synchronisation
 */
async function runSyncNhlInjuries() {
  const runId = String(Date.now());
  const runYmd = ymdUTC(new Date());
  const startedAt = Date.now();
  
  logger.info("[Injuries] Sync start (ESPN API)", { runId, runYmd });

  try {
    // 1. Récupérer toutes les blessures depuis ESPN
    logger.info("[Injuries] Fetching from ESPN API...");
    const espnInjuries = await fetchAllNHLInjuriesFromESPN();
    
    logger.info("[Injuries] Fetched from ESPN", { 
      count: espnInjuries.length,
      apiRequestsUsed: 1,
    });

    if (espnInjuries.length === 0) {
      logger.warn("[Injuries] No injuries returned from ESPN");
    }

    // 2. Récupérer TOUS les joueurs NHL depuis Firestore
    const nhlPlayers = await getAllNHLPlayersFromFirestore();
    
    if (nhlPlayers.length === 0) {
      logger.error("[Injuries] No NHL players found. Run refreshNhlPlayers first!");
      return { ok: false, error: "No NHL players in Firestore" };
    }

    // 3. Matcher les blessures avec les joueurs NHL
    logger.info("[Injuries] Starting matching process...");
    
    const matches = [];
    const injuredPlayerIds = new Set();
    const matchStats = {
      total: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      notMatched: espnInjuries.length,
    };

    for (const nhlPlayer of nhlPlayers) {
      const matchResult = findBestMatch(nhlPlayer, espnInjuries, 80);
      
      if (matchResult) {
        matches.push({
          nhlPlayerId: nhlPlayer.nhlPlayerId,
          nhlPlayer,
          injury: matchResult.match,
          matchScore: matchResult.score,
          confidence: matchResult.confidence,
        });
        
        injuredPlayerIds.add(nhlPlayer.nhlPlayerId);
        
        matchStats.total++;
        matchStats.notMatched--;
        
        if (matchResult.confidence === "high") {
          matchStats.highConfidence++;
        } else if (matchResult.confidence === "medium") {
          matchStats.mediumConfidence++;
        }
      }
    }
    
    logger.info("[Injuries] Matching completed", {
      totalNHLPlayers: nhlPlayers.length,
      totalESPNInjuries: espnInjuries.length,
      matchesFound: matches.length,
      ...matchStats,
    });

    // Log quelques exemples
    if (matches.length > 0) {
      logMatchingResults(matches.slice(0, 10).map(m => ({
        nhlPlayerId: m.nhlPlayerId,
        nhlName: m.nhlPlayer.fullName,
        sportsDbName: m.injury.strPlayer,
        teamAbbrev: m.nhlPlayer.teamAbbr,
        score: m.matchScore,
        confidence: m.confidence,
        injury: m.injury,
      })));
    }

    // 4. Upsert les blessures dans nhl_players
    logger.info("[Injuries] Upserting injuries to Firestore...");
    
    let batch = db.batch();
    let batchCount = 0;
    let upsertedCount = 0;

    for (const match of matches) {
      const ref = db.collection("nhl_players").doc(match.nhlPlayerId);
      
      // ✅ Nettoyer les données avant l'upsert
      const injuryData = mapInjuryToPlayerFormat(match.injury);
      
      const updateData = cleanUndefined({
        injury: injuryData,
        injuryMappingRunId: runId,
        injuryMatchScore: match.matchScore,
        injuryMatchConfidence: match.confidence,
        injuryLastMapped: FieldValue.serverTimestamp(),
      });
      
      batch.set(ref, updateData, { merge: true });
      
      batchCount++;
      upsertedCount++;

      if (batchCount >= BATCH_MAX) {
        await batch.commit();
        logger.info(`[Injuries] Batch committed (${upsertedCount} so far)`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    logger.info("[Injuries] Injuries upserted", { count: upsertedCount });

    // 5. Clear les blessures obsolètes
    const clearedCount = await clearStaleInjuries(runId, injuredPlayerIds);

    // 6. Stocker les stats
    const duration = Date.now() - startedAt;
    
    await db.collection("_jobs").doc("syncNhlInjuries").set({
      ok: true,
      runId,
      runYmd,
      nhlPlayersTotal: nhlPlayers.length,
      espnInjuriesTotal: espnInjuries.length,
      matchesFound: matches.length,
      injuriesUpserted: upsertedCount,
      injuriesCleared: clearedCount,
      matchStats,
      apiRequestsUsed: 1,
      durationMs: duration,
      ranAt: FieldValue.serverTimestamp(),
      source: "nhlInjuriesSync.js (ESPN)",
    }, { merge: true });

    logger.info("[Injuries] Sync completed successfully", {
      runId,
      nhlPlayersTotal: nhlPlayers.length,
      espnInjuriesTotal: espnInjuries.length,
      matchesFound: matches.length,
      injuriesUpserted: upsertedCount,
      injuriesCleared: clearedCount,
      apiRequestsUsed: 1,
      durationMs: duration,
    });

    return {
      ok: true,
      runId,
      nhlPlayersTotal: nhlPlayers.length,
      espnInjuriesTotal: espnInjuries.length,
      matchesFound: matches.length,
      injuriesUpserted: upsertedCount,
      injuriesCleared: clearedCount,
      apiRequestsUsed: 1,
      durationMs: duration,
    };

  } catch (error) {
    logger.error("[Injuries] Sync failed", { 
      error: error.message, 
      stack: error.stack 
    });
    
    await db.collection("_jobs").doc("syncNhlInjuries").set({
      ok: false,
      error: error.message,
      runId,
      ranAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    
    throw error;
  }
}

/**
 * Cloud Function schedulée - 1x par jour à midi
 */
export const syncNhlInjuries = onSchedule(
  {
    schedule: "0 12 * * *",
    //schedule: "*/2 * * * *", // pour test
    timeZone: "America/Toronto",
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async () => {
    await runSyncNhlInjuries();
  }
);

/**
 * Callable function pour tests manuels
 */
export const syncNhlInjuriesManual = onCall(
  { 
    region: "us-central1", 
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    return await runSyncNhlInjuries();
  }
);

