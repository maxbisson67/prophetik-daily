import firestore from "@react-native-firebase/firestore";
import { snapshotExists, snapshotData } from "@src/lib/safeSnapshot";
import {
  getSeasonPairForLeague,
  getSeasonStats,
  normalizeStatsBySeason,
} from "./seasonStatsHelpers";
import { filterFgcSelectablePlayers } from "./fgcPlayerFilters";

/** Lots getAll — aligné sur enrichNhlPoolPlayers. */
const STATS_CHUNK = 100;
/** En secours si getAll échoue (Android): évite 30+ GET parallèles → unavailable. */
const STATS_GET_CONCURRENCY = 4;

function pickMlbDisplayFields(row = {}) {
  return {
    rbi: Number(row.rbi) || 0,
    homeRuns: Number(row.homeRuns) || 0,
    gamesPlayed: Number(row.gamesPlayed) || 0,
    battingAverage: row.battingAverage ?? null,
    ops: row.ops ?? null,
    hits: Number(row.hits) || 0,
    atBats: Number(row.atBats) || 0,
    plateAppearances: Number(row.plateAppearances) || 0,
    runs: Number(row.runs) || 0,
  };
}

function pickNhlDisplayFields(row = {}) {
  return {
    goals: Number(row.goals) || 0,
    assists: Number(row.assists) || 0,
    points: Number(row.points) || 0,
    gamesPlayed: Number(row.gamesPlayed) || 0,
    pointsPerGame: Number(row.pointsPerGame) || 0,
    coeff: Number.isFinite(Number(row.coeff)) ? Number(row.coeff) : null,
  };
}

function mergeStatsMaps(...maps) {
  const out = {};
  for (const map of maps) {
    for (const [seasonId, stats] of Object.entries(map || {})) {
      if (!stats || typeof stats !== "object") continue;
      out[String(seasonId)] = { ...(out[String(seasonId)] || {}), ...stats };
    }
  }
  return out;
}

function seasonStatsLookComplete(stats, league) {
  if (!stats || typeof stats !== "object") return false;
  // Snapshot dénormalisé depuis nhl_players / mlb_players — pas besoin de relire stats_current.
  if (stats.syncedAt != null) return true;
  const gp = Number(stats.gamesPlayed ?? 0);
  if (gp > 0) return true;
  if (String(league).toUpperCase() === "MLB") {
    return Number(stats.rbi ?? 0) > 0 || Number(stats.atBats ?? 0) > 0;
  }
  return Number(stats.goals ?? 0) > 0 || Number(stats.points ?? 0) > 0;
}

function playerNeedsSeasonFetch(player, seasonId, league) {
  if (!seasonId) return false;
  const embedded = getSeasonStats(player?.statsBySeason, seasonId);
  return !seasonStatsLookComplete(embedded, league);
}

async function readDocRefsWithFallback(refs) {
  if (!refs.length) return [];

  try {
    if (typeof firestore().getAll === "function") {
      return await firestore().getAll(...refs);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("[loadFgcPlayers] getAll failed", err?.code, err?.message);
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

async function readStatsChunk(chunkRefs, chunkMeta, pickFields) {
  const byPlayer = {};
  const snaps = await readDocRefsWithFallback(chunkRefs);

  snaps.forEach((snap, idx) => {
    if (!snapshotExists(snap)) return;
    const row = snapshotData(snap) || {};
    const { playerId, seasonId } = chunkMeta[idx];
    if (!byPlayer[playerId]) byPlayer[playerId] = {};
    byPlayer[playerId][seasonId] = pickFields(row);
  });

  return byPlayer;
}

async function loadStatsByPlayerIds(collectionName, playerIds, seasonIds, pickFields) {
  const refs = [];
  const meta = [];

  for (const playerId of playerIds) {
    for (const seasonId of seasonIds) {
      refs.push(firestore().doc(`${collectionName}/${seasonId}_${playerId}`));
      meta.push({ playerId, seasonId });
    }
  }

  if (!refs.length) return {};

  const chunkCount = Math.ceil(refs.length / STATS_CHUNK);
  const partials = await Promise.all(
    Array.from({ length: chunkCount }, (_, chunkIdx) => {
      const start = chunkIdx * STATS_CHUNK;
      return readStatsChunk(
        refs.slice(start, start + STATS_CHUNK),
        meta.slice(start, start + STATS_CHUNK),
        pickFields
      );
    })
  );

  const byPlayer = {};
  for (const partial of partials) {
    for (const [playerId, seasons] of Object.entries(partial)) {
      if (!byPlayer[playerId]) byPlayer[playerId] = {};
      Object.assign(byPlayer[playerId], seasons);
    }
  }

  return byPlayer;
}

function leagueMeta(L) {
  const playersCollection = L === "MLB" ? "mlb_players" : "nhl_players";
  const statsCollection = L === "MLB" ? "mlb_player_stats_current" : "nhl_player_stats_current";
  const pickFields = L === "MLB" ? pickMlbDisplayFields : pickNhlDisplayFields;
  return { playersCollection, statsCollection, pickFields };
}

async function fetchFgcActiveRoster(home, away, L) {
  const { playersCollection } = leagueMeta(L);
  const playersSnap = await firestore()
    .collection(playersCollection)
    .where("teamAbbr", "in", [home, away])
    .where("active", "==", true)
    .get();

  return (playersSnap?.docs ?? []).map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      ...data,
      statsBySeason: normalizeStatsBySeason(data.statsBySeason),
    };
  });
}

function mergeRosterWithFetchedStats(rosterRows, statsByPlayer, L) {
  return filterFgcSelectablePlayers(
    rosterRows.map((p) => {
      const playerId = String(p.playerId || p.id || "").trim();
      const fetchedStats = statsByPlayer[playerId] || {};

      return {
        ...p,
        statsBySeason: mergeStatsMaps(p.statsBySeason, fetchedStats),
      };
    }),
    L
  );
}

function playerIdsNeedingSeasons(rosterRows, seasonIds, L) {
  const playerIds = [
    ...new Set(
      rosterRows
        .map((p) => String(p.playerId || p.id || "").trim())
        .filter(Boolean)
    ),
  ];

  return playerIds.filter((playerId) => {
    const row = rosterRows.find((p) => String(p.playerId || p.id || "").trim() === playerId);
    return seasonIds.some((seasonId) => playerNeedsSeasonFetch(row, seasonId, L));
  });
}

async function fetchAndMergeSeasonStatsOntoRoster(rosterRows, L, seasonIds) {
  const ids = seasonIds.filter(Boolean);
  if (!ids.length) return;

  const needing = playerIdsNeedingSeasons(rosterRows, ids, L);
  if (!needing.length) return;

  const { statsCollection, pickFields } = leagueMeta(L);
  const statsByPlayer = await loadStatsByPlayerIds(statsCollection, needing, ids, pickFields);

  for (const row of rosterRows) {
    const playerId = String(row.playerId || row.id || "").trim();
    const fetchedStats = statsByPlayer[playerId];
    if (!fetchedStats) continue;
    row.statsBySeason = mergeStatsMaps(row.statsBySeason, fetchedStats);
  }
}

function playersFromRosterRows(rosterRows, L) {
  return mergeRosterWithFetchedStats(rosterRows, {}, L);
}

export async function loadFgcPlayersWithSeasonStats({
  league,
  homeAbbr,
  awayAbbr,
  includePreviousSeason = true,
}) {
  const home = String(homeAbbr || "").trim().toUpperCase();
  const away = String(awayAbbr || "").trim().toUpperCase();
  const L = String(league || "NHL").toUpperCase();

  if (!home || !away) {
    return { players: [], league: L, seasonPair: getSeasonPairForLeague(L) };
  }

  const seasonPair = getSeasonPairForLeague(L);
  const seasonIds = includePreviousSeason
    ? [seasonPair.current, seasonPair.previous].filter(Boolean)
    : [seasonPair.current].filter(Boolean);

  const rosterRows = await fetchFgcActiveRoster(home, away, L);
  await fetchAndMergeSeasonStatsOntoRoster(rosterRows, L, seasonIds);
  const players = playersFromRosterRows(rosterRows, L);

  return { players, league: L, seasonPair };
}

/**
 * Une seule requête roster; affichage immédiat avec stats dénormalisées;
 * puis complète courante / N-1 sans recharger le roster.
 */
function publishFgcPlayers(rosterRows, L, seasonPair, cb) {
  if (typeof cb !== "function") return;
  cb(playersFromRosterRows(rosterRows, L), seasonPair);
}

export async function loadFgcPlayersProgressive({
  league,
  homeAbbr,
  awayAbbr,
  onRosterReady,
  onStatsReady,
}) {
  const home = String(homeAbbr || "").trim().toUpperCase();
  const away = String(awayAbbr || "").trim().toUpperCase();
  const L = String(league || "NHL").toUpperCase();
  const seasonPair = getSeasonPairForLeague(L);

  if (!home || !away) {
    publishFgcPlayers([], L, seasonPair, onRosterReady);
    return { players: [], league: L, seasonPair };
  }

  const rosterRows = await fetchFgcActiveRoster(home, away, L);
  publishFgcPlayers(rosterRows, L, seasonPair, onRosterReady);

  const currentId = seasonPair.current ? String(seasonPair.current) : "";
  const previousId =
    seasonPair.previous && String(seasonPair.previous) !== currentId
      ? String(seasonPair.previous)
      : "";
  const seasonIds = [...new Set([currentId, previousId].filter(Boolean))];

  if (seasonIds.length) {
    const needing = playerIdsNeedingSeasons(rosterRows, seasonIds, L);
    if (needing.length) {
      await fetchAndMergeSeasonStatsOntoRoster(rosterRows, L, seasonIds);
      publishFgcPlayers(rosterRows, L, seasonPair, onStatsReady);
    }
  }

  const players = playersFromRosterRows(rosterRows, L);
  return { players, league: L, seasonPair };
}
