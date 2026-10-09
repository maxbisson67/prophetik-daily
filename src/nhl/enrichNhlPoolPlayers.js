import firestore from "@react-native-firebase/firestore";
import { normalizeNhlSeasonStatRow } from "./nhlSeasonStatDisplay";

/** Firestore getAll — taille de lot (docs). */
const STATS_CHUNK = 100;
const STATS_GET_CONCURRENCY = 4;

function pickNhlDisplayFields(row = {}) {
  return normalizeNhlSeasonStatRow(row);
}

export function nhlPoolSeasonStatsUsable(player, seasonId) {
  const sid = String(seasonId || "").trim();
  if (!sid) return false;
  const map = player?.statsBySeason;
  const s = map && typeof map === "object" ? map[sid] : null;
  if (!s || typeof s !== "object") return false;

  const gp = Number(s.gamesPlayed) || 0;
  if (gp > 0) return true;
  const goals = Number(s.goals) || 0;
  const points = Number(s.points) || 0;
  return goals > 0 || points > 0;
}

/** Pool créé par onDefiCreated inclut statsBySeason — pas besoin de relire Firestore. */
export function poolHasEmbeddedNhlStats(list, currentSeasonId, previousSeasonId) {
  if (!Array.isArray(list) || list.length < 3) return false;

  const current = String(currentSeasonId || "").trim();
  if (!current) return false;

  const previous = String(previousSeasonId || "").trim();
  const needPrevious = Boolean(previous && previous !== current);
  const threshold = Math.max(3, Math.ceil(list.length * 0.85));

  let ok = 0;
  for (const p of list) {
    if (!nhlPoolSeasonStatsUsable(p, current)) continue;
    if (needPrevious && !nhlPoolSeasonStatsUsable(p, previous)) continue;
    ok += 1;
  }

  return ok >= threshold;
}

function applySeasonRowToPlayer(player, seasonId, fresh) {
  const sid = String(seasonId || "").trim();
  const statsBySeason = { ...(player.statsBySeason || {}) };
  if (fresh != null) {
    statsBySeason[sid] = fresh;
  } else if (statsBySeason[sid]) {
    statsBySeason[sid] = normalizeNhlSeasonStatRow(statsBySeason[sid]);
  } else {
    statsBySeason[sid] = pickNhlDisplayFields({});
  }
  return { ...player, statsBySeason };
}

/** Normalise statsBySeason embarquées (sync, sans réseau). */
export function normalizeNhlPoolPlayersEmbedded(
  list,
  { currentSeasonId, previousSeasonId } = {}
) {
  if (!Array.isArray(list) || !list.length) return list;

  const current = String(currentSeasonId || "").trim();
  const previous = String(previousSeasonId || "").trim();

  return list.map((p) => {
    let out = p;
    if (current) out = applySeasonRowToPlayer(out, current, null);
    if (previous && previous !== current) out = applySeasonRowToPlayer(out, previous, null);
    return out;
  });
}

async function readDocRefsWithFallback(refs) {
  if (!refs.length) return [];

  try {
    if (typeof firestore().getAll === "function") {
      return await firestore().getAll(...refs);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("[enrichNhlPool] getAll failed", err?.code, err?.message);
    }
  }

  const snaps = [];
  for (let i = 0; i < refs.length; i += STATS_GET_CONCURRENCY) {
    const slice = refs.slice(i, i + STATS_GET_CONCURRENCY);
    const batch = await Promise.all(slice.map((ref) => ref.get()));
    snaps.push(...batch);
  }
  return snaps;
}

async function fetchStatsChunk(chunkRefs, chunkMeta) {
  const byKey = {};
  const snaps = await readDocRefsWithFallback(chunkRefs);

  snaps.forEach((s, idx) => {
    if (!s.exists) return;
    const d = s.data() || {};
    const { playerId, seasonId } = chunkMeta[idx] || {};
    const pid = String(playerId || d.playerId || "");
    const sid = String(seasonId || d.seasonId || "");
    if (!pid || !sid) return;
    byKey[`${sid}_${pid}`] = pickNhlDisplayFields(d);
  });

  return byKey;
}

async function mergeOneSeasonIntoList(list, seasonId) {
  const sid = String(seasonId || "").trim();
  if (!sid || !Array.isArray(list) || !list.length) return list;

  const needing = list.filter((p) => !nhlPoolSeasonStatsUsable(p, sid));

  if (!needing.length) {
    return list.map((p) => applySeasonRowToPlayer(p, sid, null));
  }

  const refs = [];
  const meta = [];

  for (const p of needing) {
    const playerId = String(p?.playerId || "").trim();
    if (!playerId) continue;
    refs.push(firestore().doc(`nhl_player_stats_current/${sid}_${playerId}`));
    meta.push({ playerId, seasonId: sid });
  }

  if (!refs.length) {
    return list.map((p) => applySeasonRowToPlayer(p, sid, null));
  }

  const statsByKey = {};
  const chunkCount = Math.ceil(refs.length / STATS_CHUNK);

  await Promise.all(
    Array.from({ length: chunkCount }, (_, chunkIdx) => {
      const start = chunkIdx * STATS_CHUNK;
      return fetchStatsChunk(
        refs.slice(start, start + STATS_CHUNK),
        meta.slice(start, start + STATS_CHUNK)
      ).then((partial) => {
        Object.assign(statsByKey, partial);
      });
    })
  );

  return list.map((p) => {
    const playerId = String(p?.playerId || "").trim();
    const fresh = statsByKey[`${sid}_${playerId}`];
    if (fresh != null) {
      return applySeasonRowToPlayer(p, sid, fresh);
    }
    return applySeasonRowToPlayer(p, sid, null);
  });
}

/**
 * Complète statsBySeason seulement si absentes (pool legacy).
 * Les défis récents ont déjà le snapshot dans playerPool.
 */
export async function enrichNhlPoolPlayers(
  list,
  { currentSeasonId, previousSeasonId, onProgress } = {}
) {
  if (!Array.isArray(list) || !list.length) return list;

  const current = String(currentSeasonId || "").trim();
  const previous = String(previousSeasonId || "").trim();

  let out = normalizeNhlPoolPlayersEmbedded(list, { currentSeasonId: current, previousSeasonId: previous });

  if (typeof onProgress === "function") {
    onProgress(out, { phase: "embedded" });
  }

  if (poolHasEmbeddedNhlStats(out, current, previous)) {
    return out;
  }

  if (current) {
    out = await mergeOneSeasonIntoList(out, current);
    if (typeof onProgress === "function") {
      onProgress(out, { phase: "current" });
    }
  }

  if (previous && previous !== current) {
    out = await mergeOneSeasonIntoList(out, previous);
    if (typeof onProgress === "function") {
      onProgress(out, { phase: "previous" });
    }
  }

  return out;
}
