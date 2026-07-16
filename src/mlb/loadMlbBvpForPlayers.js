import firestore from "@react-native-firebase/firestore";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import functions from "@react-native-firebase/functions";

const READ_CHUNK = 30;
const DIRECT_FETCH_CONCURRENCY = 6;
const BVP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BVP_EMPTY_CACHE_TTL_MS = 60 * 60 * 1000;
const BVP_ERROR_CACHE_TTL_MS = 15 * 60 * 1000;
const liveVerifiedEmptyKeys = new Map();

export function normalizeMlbPitcherId(pitcher) {
  const raw =
    pitcher?.id ??
    pitcher?.playerId ??
    pitcher?.personId ??
    pitcher?.pitcherId ??
    null;

  if (raw == null) return "";

  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    return n > 0 ? String(n) : "";
  }

  if (typeof raw === "object" && typeof raw.toString === "function") {
    const asString = String(raw.toString()).trim();
    if (/^\d+$/.test(asString) && asString !== "0") return asString;
  }

  const id = String(raw).trim();
  if (!id || id === "0" || id === "null" || id === "undefined") return "";
  if (!/^\d+$/.test(id)) return "";
  return id;
}

const BVP_STATS_URL = (batterId, pitcherId) =>
  `https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(String(batterId))}/stats?stats=vsPlayerTotal&group=hitting&opposingPlayerId=${encodeURIComponent(String(pitcherId))}&gameType=R`;

export function mlbBvpDocId(batterId, pitcherId) {
  return `${String(batterId)}_${String(pitcherId)}`;
}

function bvpConfidenceFromPa(pa) {
  const n = Number(pa) || 0;
  if (n >= 15) return "high";
  if (n >= 8) return "medium";
  if (n >= 3) return "low";
  if (n > 0) return "minimal";
  return "none";
}

function tsToMillis(v) {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

function clientCacheTtlMs(row) {
  if (row?.fetchError) return BVP_ERROR_CACHE_TTL_MS;
  if (row?.hasSample || Number(row?.pa) > 0) return BVP_CACHE_TTL_MS;
  return BVP_EMPTY_CACHE_TTL_MS;
}

function isClientCacheFresh(row, nowMs = Date.now()) {
  if (!row) return false;
  const fetchedAt = tsToMillis(row.fetchedAtMs ?? row.fetchedAt);
  if (!fetchedAt) return false;
  return nowMs - fetchedAt < clientCacheTtlMs(row);
}

export function normalizeBvpClientRow(row) {
  if (!row || typeof row !== "object") return null;
  const pa = Number(row.pa) || 0;
  const fetchError = row.fetchError ? String(row.fetchError) : null;
  const fetchedAtMs = tsToMillis(row.fetchedAtMs ?? row.fetchedAt) || null;
  return {
    pa,
    ab: Number(row.ab) || 0,
    hits: Number(row.hits) || 0,
    homeRuns: Number(row.homeRuns) || 0,
    rbi: Number(row.rbi) || 0,
    avg: row.avg ?? null,
    ops: row.ops ?? null,
    hasSample: row.hasSample === true || pa > 0,
    confidence: row.confidence || bvpConfidenceFromPa(pa),
    sampleLabel: row.sampleLabel || "career",
    pitcherId: row.pitcherId ?? null,
    pitcherName: row.pitcherName ?? null,
    source: row.source ?? null,
    fetchedAtMs,
    fetchError,
  };
}

function parseBvpStatsApiJson(json, batterId, pitcherId, meta = {}) {
  const stats = Array.isArray(json?.stats) ? json.stats : [];
  const block =
    stats.find((s) => String(s?.type?.displayName || "").toLowerCase() === "vsplayertotal") ||
    stats[0];
  const split = Array.isArray(block?.splits) ? block.splits[0] : null;
  const stat = split?.stat;

  if (!stat) {
    return normalizeBvpClientRow({
      pa: 0,
      hasSample: false,
      confidence: "none",
      pitcherId,
      pitcherName: meta.pitcherName || split?.pitcher?.fullName || null,
      source: "statsapi_vsPlayerTotal",
    });
  }

  const pa = Number(stat.plateAppearances) || 0;
  return normalizeBvpClientRow({
    pa,
    ab: Number(stat.atBats) || 0,
    hits: Number(stat.hits) || 0,
    homeRuns: Number(stat.homeRuns) || 0,
    rbi: Number(stat.rbi) || 0,
    avg: stat.avg != null ? String(stat.avg) : null,
    ops: stat.ops != null ? String(stat.ops) : null,
    hasSample: pa > 0,
    confidence: bvpConfidenceFromPa(pa),
    sampleLabel: "career",
    pitcherId,
    pitcherName: meta.pitcherName || split?.pitcher?.fullName || null,
    source: "statsapi_vsPlayerTotal",
  });
}

async function fetchBvpDirectFromMlbApi(batterId, pitcherId, meta = {}) {
  const bid = String(batterId || "").trim();
  const pid = String(pitcherId || "").trim();
  if (!bid || !pid) return null;

  const res = await fetch(BVP_STATS_URL(bid, pid), {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });

  if (!res.ok) {
    throw new Error(`MLB BvP ${res.status} batter=${bid} pitcher=${pid}`);
  }

  const json = await res.json();
  return parseBvpStatsApiJson(json, bid, pid, meta);
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

async function readBvpCache(pairs) {
  const out = new Map();
  if (!pairs.length) return out;

  for (let i = 0; i < pairs.length; i += READ_CHUNK) {
    const chunk = pairs.slice(i, i + READ_CHUNK);
    const refs = chunk.map((p) => firestore().doc(`mlb_bvp/${mlbBvpDocId(p.batterId, p.pitcherId)}`));

    let snaps = [];
    try {
      if (typeof firestore().getAll === "function") {
        snaps = await firestore().getAll(...refs);
      } else {
        snaps = await Promise.all(refs.map((ref) => ref.get()));
      }
    } catch {
      snaps = await Promise.all(refs.map((ref) => ref.get()));
    }

    snaps.forEach((snap, idx) => {
      if (!snapshotExists(snap)) return;
      const pair = chunk[idx];
      const normalized = normalizeBvpClientRow(snapshotData(snap) || {});
      if (normalized) {
        out.set(mlbBvpDocId(pair.batterId, pair.pitcherId), normalized);
      }
    });
  }

  return out;
}

function pairNeedsFetch(cache, pair) {
  const key = mlbBvpDocId(pair.batterId, pair.pitcherId);
  const row = cache.get(key);
  if (!row) return true;
  if (row.fetchError) return true;
  if (!isClientCacheFresh(row)) return true;
  return false;
}

function pairNeedsLiveVerify(cache, pair) {
  const key = mlbBvpDocId(pair.batterId, pair.pitcherId);
  const row = cache.get(key);
  if (!row) return true;
  if (row.fetchError) return true;
  if (row.hasSample || Number(row.pa) > 0) return false;

  const verifiedAt = liveVerifiedEmptyKeys.get(key);
  if (verifiedAt && Date.now() - verifiedAt < BVP_EMPTY_CACHE_TTL_MS) return false;

  // « Pas d'historique » en cache Firestore — confirmer via l'API MLB.
  return true;
}

/**
 * Enrichit une liste de joueurs avec bvpVsOpposingStarter (cache Firestore + callable + API MLB directe).
 */
export async function enrichPlayersWithMlbBvp(players = [], pitcher, { forceRefresh = false } = {}) {
  const pitcherId = normalizeMlbPitcherId(pitcher);
  if (!pitcherId || !Array.isArray(players) || !players.length) {
    return players;
  }

  const pairs = players
    .map((p) => ({
      batterId: String(p?.playerId ?? p?.id ?? ""),
      pitcherId,
      batterName: p?.fullName || p?.name || null,
      pitcherName: pitcher?.name || null,
    }))
    .filter((p) => p.batterId);

  if (!pairs.length) return players;

  let cache = forceRefresh ? new Map() : await readBvpCache(pairs);
  const cacheHits = pairs.length - pairs.filter((p) => pairNeedsFetch(cache, p)).length;
  let misses = pairs.filter((p) => pairNeedsFetch(cache, p));

  if (__DEV__ && pairs.length) {
    console.log("[loadMlbBvp] cache", {
      pitcherId,
      total: pairs.length,
      cacheHits,
      misses: misses.length,
    });
  }

  if (misses.length) {
    try {
      const call = functions().httpsCallable("prefetchMlbBvp");
      const res = await call({ pairs: misses });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];

      if (__DEV__) {
        const withSample = rows.filter((r) => r?.hasSample || Number(r?.pa) > 0).length;
        console.log("[loadMlbBvp] prefetchMlbBvp", {
          requested: misses.length,
          returned: rows.length,
          withSample,
          pitcherId,
        });
      }

      for (const row of rows) {
        const bid = String(row?.batterId || "");
        const pid = String(row?.pitcherId || pitcherId);
        if (!bid) continue;
        const normalized = normalizeBvpClientRow(row);
        if (normalized) cache.set(mlbBvpDocId(bid, pid), normalized);
      }
    } catch (e) {
      console.warn("[loadMlbBvp] prefetchMlbBvp failed", e?.message || e);
    }
  }

  misses = pairs.filter((p) => pairNeedsFetch(cache, p));
  const verifyEmpties = pairs.filter((p) => pairNeedsLiveVerify(cache, p));
  const directTargets = forceRefresh
    ? pairs
    : [...new Map([...misses, ...verifyEmpties].map((p) => [mlbBvpDocId(p.batterId, p.pitcherId), p])).values()];

  if (directTargets.length) {
    const directRows = await mapWithConcurrency(directTargets, DIRECT_FETCH_CONCURRENCY, async (pair) => {
      try {
        return await fetchBvpDirectFromMlbApi(pair.batterId, pair.pitcherId, pair);
      } catch (e) {
        if (__DEV__) {
          console.warn("[loadMlbBvp] direct MLB fetch failed", {
            batterId: pair.batterId,
            pitcherId: pair.pitcherId,
            error: e?.message || e,
          });
        }
        return null;
      }
    });

    let directHits = 0;
    directRows.forEach((row, idx) => {
      if (!row) return;
      const pair = directTargets[idx];
      const key = mlbBvpDocId(pair.batterId, pair.pitcherId);
      if (row.hasSample) directHits += 1;
      else liveVerifiedEmptyKeys.set(key, Date.now());
      cache.set(key, {
        ...row,
        source: row.source || "statsapi_vsPlayerTotal",
        fetchedAtMs: Date.now(),
      });
    });

    if (__DEV__) {
      console.log("[loadMlbBvp] direct MLB fallback", {
        attempted: directTargets.length,
        withSample: directHits,
        pitcherId,
      });
    }
  }

  return players.map((p) => {
    const batterId = String(p?.playerId ?? p?.id ?? "");
    const bvp = cache.get(mlbBvpDocId(batterId, pitcherId)) || null;
    return {
      ...p,
      bvpVsOpposingStarter: bvp,
    };
  });
}
