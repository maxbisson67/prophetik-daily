/**
 * Dénormalise les stats saisonnières vers mlb_players / nhl_players.statsBySeason
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  getMlbSeasonPair,
  getNhlSeasonPair,
} from "./seasonHelpers.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

export const STATS_DENORM_VERSION = "v1";
const BATCH_MAX = 400;

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function pickMlbDenormFields(row = {}) {
  return {
    rbi: toNum(row.rbi),
    homeRuns: toNum(row.homeRuns),
    gamesPlayed: toNum(row.gamesPlayed),
    battingAverage: row.battingAverage ?? null,
    ops: row.ops ?? null,
    hits: toNum(row.hits),
    atBats: toNum(row.atBats),
    plateAppearances: toNum(row.plateAppearances),
    runs: toNum(row.runs),
    syncedAt: FieldValue.serverTimestamp(),
  };
}

function pickNhlDenormFields(row = {}) {
  const meta = row.coeff_meta && typeof row.coeff_meta === "object" ? row.coeff_meta : {};

  return {
    goals: toNum(row.goals),
    assists: toNum(row.assists),
    points: toNum(row.points),
    gamesPlayed: toNum(row.gamesPlayed),
    pointsPerGame: toNum(row.pointsPerGame),
    coeff: Number.isFinite(Number(row.coeff)) ? Number(row.coeff) : null,
    reliability: Number.isFinite(Number(meta.reliability)) ? Number(meta.reliability) : null,
    syncedAt: FieldValue.serverTimestamp(),
  };
}

async function commitBatchWrites(writes) {
  let batch = db.batch();
  let ops = 0;
  let committed = 0;

  for (const w of writes) {
    batch.set(w.ref, w.data, { merge: true });
    ops++;

    if (ops >= BATCH_MAX) {
      await batch.commit();
      committed += ops;
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
    committed += ops;
  }

  return committed;
}

export async function denormMlbStatsSeason(rows = [], seasonId) {
  const sid = String(seasonId || "").trim();
  if (!sid) return { ok: false, reason: "missing-seasonId", written: 0 };

  const writes = [];

  for (const row of rows) {
    const playerId = String(row?.playerId || "").trim();
    if (!playerId) continue;

    writes.push({
      ref: db.collection("mlb_players").doc(playerId),
      data: {
        [`statsBySeason.${sid}`]: pickMlbDenormFields(row),
        statsDenormVersion: STATS_DENORM_VERSION,
        statsDenormAt: FieldValue.serverTimestamp(),
      },
    });
  }

  const written = writes.length ? await commitBatchWrites(writes) : 0;

  logger.info("[playerStatsDenorm] MLB season synced", {
    seasonId: sid,
    rows: rows.length,
    written,
  });

  return { ok: true, seasonId: sid, rows: rows.length, written };
}

export async function denormNhlStatsSeason(rows = [], seasonId) {
  const sid = String(seasonId || "").trim();
  if (!sid) return { ok: false, reason: "missing-seasonId", written: 0 };

  const writes = [];

  for (const row of rows) {
    const playerId = String(row?.playerId || "").trim();
    if (!playerId) continue;

    writes.push({
      ref: db.collection("nhl_players").doc(playerId),
      data: {
        [`statsBySeason.${sid}`]: pickNhlDenormFields(row),
        statsDenormVersion: STATS_DENORM_VERSION,
        statsDenormAt: FieldValue.serverTimestamp(),
      },
    });
  }

  const written = writes.length ? await commitBatchWrites(writes) : 0;

  logger.info("[playerStatsDenorm] NHL season synced", {
    seasonId: sid,
    rows: rows.length,
    written,
  });

  return { ok: true, seasonId: sid, rows: rows.length, written };
}

async function loadStatsRows(collectionName, seasonId) {
  const snap = await db
    .collection(collectionName)
    .where("seasonId", "==", String(seasonId))
    .get();

  return snap.docs.map((d) => d.data() || {});
}

export async function backfillPlayerStatsDenormFromFirestore({
  leagues = ["MLB", "NHL"],
  seasonIds = null,
  dryRun = false,
} = {}) {
  const wanted = new Set(
    (Array.isArray(leagues) ? leagues : [leagues]).map((x) => String(x).toUpperCase())
  );

  const mlbPair = getMlbSeasonPair();
  const nhlPair = getNhlSeasonPair();

  const plan = [];

  if (wanted.has("MLB")) {
    const seasons = seasonIds?.mlb || seasonIds?.MLB || [mlbPair.current, mlbPair.previous];
    for (const seasonId of seasons) {
      plan.push({ league: "MLB", collection: "mlb_player_stats_current", seasonId });
    }
  }

  if (wanted.has("NHL")) {
    const seasons = seasonIds?.nhl || seasonIds?.NHL || [nhlPair.current, nhlPair.previous];
    for (const seasonId of seasons) {
      plan.push({ league: "NHL", collection: "nhl_player_stats_current", seasonId });
    }
  }

  const results = [];

  for (const step of plan) {
    const rows = await loadStatsRows(step.collection, step.seasonId);

    if (dryRun) {
      results.push({
        ...step,
        dryRun: true,
        rowCount: rows.length,
      });
      continue;
    }

    const denorm =
      step.league === "MLB"
        ? await denormMlbStatsSeason(rows, step.seasonId)
        : await denormNhlStatsSeason(rows, step.seasonId);

    results.push({
      ...step,
      ...denorm,
    });
  }

  return {
    ok: true,
    dryRun,
    mlbSeasons: wanted.has("MLB") ? [mlbPair.current, mlbPair.previous] : [],
    nhlSeasons: wanted.has("NHL") ? [nhlPair.current, nhlPair.previous] : [],
    results,
  };
}

export const backfillPlayerStatsDenorm = onCall(
  { region: "us-central1", timeoutSeconds: 540 },
  async (req) => {
    try {
      const leagues = req.data?.leagues || ["MLB", "NHL"];
      const seasonIds = req.data?.seasonIds || null;
      const dryRun = req.data?.dryRun === true;

      return await backfillPlayerStatsDenormFromFirestore({
        leagues,
        seasonIds,
        dryRun,
      });
    } catch (e) {
      logger.error("[backfillPlayerStatsDenorm]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);
