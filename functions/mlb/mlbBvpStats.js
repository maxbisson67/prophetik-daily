/**
 * Batter vs Pitcher (BvP) — MLB Stats API vsPlayerTotal + cache Firestore.
 *
 * Collection: mlb_bvp/{batterId}_{pitcherId}
 */

import { db, FieldValue, logger } from "../utils.js";

export const MLB_BVP_COLLECTION = "mlb_bvp";
export const BVP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const BVP_STATS_URL = (batterId, pitcherId) =>
  `https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(String(batterId))}/stats?stats=vsPlayerTotal&group=hitting&opposingPlayerId=${encodeURIComponent(String(pitcherId))}&gameType=R`;

function str(v) {
  return String(v ?? "").trim();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tsToMillis(v) {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

export function bvpDocId(batterId, pitcherId) {
  return `${str(batterId)}_${str(pitcherId)}`;
}

export function bvpConfidenceFromPa(pa) {
  const n = num(pa, 0);
  if (n >= 15) return "high";
  if (n >= 8) return "medium";
  if (n >= 3) return "low";
  if (n > 0) return "minimal";
  return "none";
}

/** Seuil produit : BvP cité dans l'avis Nova seulement au-delà de 9 PA carrière. */
export const BVP_MIN_PA_FOR_COACH = 10;

export function isBvpActionableForCoach(bvp) {
  const pa = num(bvp?.pa, 0);
  return pa >= BVP_MIN_PA_FOR_COACH;
}

export function normalizeBvpRow(stat = {}, meta = {}) {
  const pa = num(stat.plateAppearances, 0);
  const ab = num(stat.atBats, 0);
  const hits = num(stat.hits, 0);
  const homeRuns = num(stat.homeRuns, 0);
  const rbi = num(stat.rbi, 0);

  return {
    batterId: str(meta.batterId) || null,
    batterName: str(meta.batterName) || null,
    pitcherId: str(meta.pitcherId) || null,
    pitcherName: str(meta.pitcherName) || null,
    pa,
    ab,
    hits,
    homeRuns,
    rbi,
    avg: stat.avg != null ? String(stat.avg) : null,
    obp: stat.obp != null ? String(stat.obp) : null,
    ops: stat.ops != null ? String(stat.ops) : null,
    gamesPlayed: num(stat.gamesPlayed, 0),
    hasSample: pa > 0,
    confidence: bvpConfidenceFromPa(pa),
    sampleLabel: "career",
    source: "statsapi_vsPlayerTotal",
  };
}

export function emptyBvpRow(batterId, pitcherId, meta = {}) {
  return normalizeBvpRow({}, {
    batterId,
    pitcherId,
    batterName: meta.batterName,
    pitcherName: meta.pitcherName,
  });
}

export function compactBvpForClient(row = {}) {
  if (!row || typeof row !== "object") return null;
  return {
    pa: num(row.pa, 0),
    ab: num(row.ab, 0),
    hits: num(row.hits, 0),
    homeRuns: num(row.homeRuns, 0),
    rbi: num(row.rbi, 0),
    avg: row.avg ?? null,
    ops: row.ops ?? null,
    hasSample: row.hasSample === true || num(row.pa, 0) > 0,
    confidence: row.confidence || bvpConfidenceFromPa(row.pa),
    sampleLabel: row.sampleLabel || "career",
    pitcherId: row.pitcherId ?? null,
    pitcherName: row.pitcherName ?? null,
  };
}

export async function fetchBvpFromStatsApi(batterId, pitcherId) {
  const bid = str(batterId);
  const pid = str(pitcherId);
  if (!bid || !pid) return emptyBvpRow(bid, pid);

  const url = BVP_STATS_URL(bid, pid);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });

  if (!res.ok) {
    throw new Error(`MLB BvP failed ${res.status} batter=${bid} pitcher=${pid}`);
  }

  const json = await res.json();
  const stats = Array.isArray(json?.stats) ? json.stats : [];
  const block = stats.find((s) => String(s?.type?.displayName || "").toLowerCase() === "vsplayertotal") || stats[0];
  const split = Array.isArray(block?.splits) ? block.splits[0] : null;

  if (!split?.stat) {
    return emptyBvpRow(bid, pid, {
      pitcherName: split?.pitcher?.fullName,
      batterName: split?.batter?.fullName,
    });
  }

  return normalizeBvpRow(split.stat, {
    batterId: bid,
    pitcherId: pid,
    batterName: split?.batter?.fullName,
    pitcherName: split?.pitcher?.fullName,
  });
}

function cacheTtlMs(doc) {
  if (doc?.fetchError) return 15 * 60 * 1000;
  const pa = num(doc?.pa, 0);
  const hasSample = doc?.hasSample === true || pa > 0;
  return hasSample ? BVP_CACHE_TTL_MS : 60 * 60 * 1000;
}

function isCacheFresh(doc, nowMs = Date.now()) {
  if (!doc) return false;
  const fetchedAt = tsToMillis(doc.fetchedAtMs ?? doc.fetchedAt);
  if (!fetchedAt) return false;
  return nowMs - fetchedAt < cacheTtlMs(doc);
}

async function readBvpCache(batterId, pitcherId) {
  const id = bvpDocId(batterId, pitcherId);
  const snap = await db.collection(MLB_BVP_COLLECTION).doc(id).get();
  return snap.exists ? snap.data() || null : null;
}

async function writeBvpCache(row) {
  const id = bvpDocId(row.batterId, row.pitcherId);
  const nowMs = Date.now();

  await db.collection(MLB_BVP_COLLECTION).doc(id).set(
    {
      ...row,
      docId: id,
      fetchedAtMs: nowMs,
      fetchedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ...row, fetchedAtMs: nowMs };
}

/**
 * @param {{ batterId: string|number, pitcherId: string|number, forceRefresh?: boolean, meta?: object }}
 */
export async function getBvpStats({ batterId, pitcherId, forceRefresh = false, meta = {} }) {
  const bid = str(batterId);
  const pid = str(pitcherId);
  if (!bid || !pid) return emptyBvpRow(bid, pid, meta);

  if (!forceRefresh) {
    const cached = await readBvpCache(bid, pid);
    if (isCacheFresh(cached)) return cached;
  }

  try {
    const row = await fetchBvpFromStatsApi(bid, pid);
    if (meta.batterName && !row.batterName) row.batterName = str(meta.batterName);
    if (meta.pitcherName && !row.pitcherName) row.pitcherName = str(meta.pitcherName);
    return await writeBvpCache(row);
  } catch (err) {
    logger.warn("[mlbBvp] fetch failed", {
      batterId: bid,
      pitcherId: pid,
      error: err?.message || String(err),
    });

    const stale = await readBvpCache(bid, pid);
    if (stale) return stale;

    const empty = emptyBvpRow(bid, pid, meta);
    try {
      return await writeBvpCache({
        ...empty,
        fetchError: err?.message || String(err),
      });
    } catch (writeErr) {
      logger.warn("[mlbBvp] cache write failed", {
        batterId: bid,
        pitcherId: pid,
        error: writeErr?.message || String(writeErr),
      });
      return empty;
    }
  }
}

function dedupePairs(pairs = []) {
  const seen = new Set();
  const out = [];

  for (const pair of pairs) {
    const batterId = str(pair?.batterId);
    const pitcherId = str(pair?.pitcherId);
    if (!batterId || !pitcherId) continue;
    const key = bvpDocId(batterId, pitcherId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      batterId,
      pitcherId,
      batterName: str(pair?.batterName) || null,
      pitcherName: str(pair?.pitcherName) || null,
    });
  }

  return out;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const cur = idx;
      idx += 1;
      results[cur] = await fn(items[cur], cur);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Resolve many BvP rows — cache-first, parallel fetch for misses.
 *
 * @returns {Promise<Map<string, object>>} key = bvpDocId
 */
export async function resolveBvpStatsBatch(pairs = [], { maxConcurrency = 8, forceRefresh = false } = {}) {
  const unique = dedupePairs(pairs);
  const out = new Map();
  if (!unique.length) return out;

  const misses = [];

  if (!forceRefresh) {
    for (let i = 0; i < unique.length; i += 400) {
      const chunkPairs = unique.slice(i, i + 400);
      const refs = chunkPairs.map((p) =>
        db.collection(MLB_BVP_COLLECTION).doc(bvpDocId(p.batterId, p.pitcherId))
      );
      const snaps = await db.getAll(...refs);
      for (let j = 0; j < snaps.length; j += 1) {
        const pair = chunkPairs[j];
        if (!pair) continue;
        const key = bvpDocId(pair.batterId, pair.pitcherId);
        const doc = snaps[j].exists ? snaps[j].data() || null : null;
        if (isCacheFresh(doc)) {
          out.set(key, doc);
        } else {
          misses.push(pair);
        }
      }
    }
  } else {
    misses.push(...unique);
  }

  if (misses.length) {
    const fetched = await mapWithConcurrency(misses, maxConcurrency, (pair) =>
      getBvpStats({
        batterId: pair.batterId,
        pitcherId: pair.pitcherId,
        forceRefresh: true,
        meta: pair,
      })
    );

    for (const row of fetched) {
      if (!row?.batterId || !row?.pitcherId) continue;
      out.set(bvpDocId(row.batterId, row.pitcherId), row);
    }
  }

  return out;
}
