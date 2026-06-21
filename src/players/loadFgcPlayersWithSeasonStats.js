import firestore from "@react-native-firebase/firestore";
import {
  getSeasonPairForLeague,
  getSeasonStats,
  normalizeStatsBySeason,
} from "./seasonStatsHelpers";
import { filterFgcSelectablePlayers } from "./fgcPlayerFilters";

const STATS_CHUNK = 30;

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

async function loadStatsByPlayerIds(collectionName, playerIds, seasonIds, pickFields) {
  const byPlayer = {};
  const refs = [];
  const meta = [];

  for (const playerId of playerIds) {
    for (const seasonId of seasonIds) {
      refs.push(firestore().doc(`${collectionName}/${seasonId}_${playerId}`));
      meta.push({ playerId, seasonId });
    }
  }

  if (!refs.length) return byPlayer;

  const readChunk = async (chunkRefs, chunkMeta) => {
    let snaps = [];
    try {
      if (typeof firestore().getAll === "function") {
        snaps = await firestore().getAll(...chunkRefs);
      } else {
        snaps = await Promise.all(chunkRefs.map((ref) => ref.get()));
      }
    } catch {
      snaps = await Promise.all(chunkRefs.map((ref) => ref.get()));
    }

    snaps.forEach((snap, idx) => {
      if (!snap?.exists) return;
      const row = snap.data() || {};
      const { playerId, seasonId } = chunkMeta[idx];
      if (!byPlayer[playerId]) byPlayer[playerId] = {};
      byPlayer[playerId][seasonId] = pickFields(row);
    });
  };

  for (let i = 0; i < refs.length; i += STATS_CHUNK) {
    await readChunk(refs.slice(i, i + STATS_CHUNK), meta.slice(i, i + STATS_CHUNK));
  }

  return byPlayer;
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
  const playersCollection = L === "MLB" ? "mlb_players" : "nhl_players";
  const statsCollection = L === "MLB" ? "mlb_player_stats_current" : "nhl_player_stats_current";
  const pickFields = L === "MLB" ? pickMlbDisplayFields : pickNhlDisplayFields;
  const seasonIds = includePreviousSeason
    ? [seasonPair.current, seasonPair.previous].filter(Boolean)
    : [seasonPair.current].filter(Boolean);

  const playersSnap = await firestore()
    .collection(playersCollection)
    .where("teamAbbr", "in", [home, away])
    .where("active", "==", true)
    .get();

  const rosterRows = (playersSnap?.docs ?? []).map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      ...data,
      statsBySeason: normalizeStatsBySeason(data.statsBySeason),
    };
  });

  const playerIds = [
    ...new Set(
      rosterRows
        .map((p) => String(p.playerId || p.id || "").trim())
        .filter(Boolean)
    ),
  ];

  const idsNeedingFetch = playerIds.filter((playerId) => {
    const row = rosterRows.find(
      (p) => String(p.playerId || p.id || "").trim() === playerId
    );
    return seasonIds.some((seasonId) => playerNeedsSeasonFetch(row, seasonId, L));
  });

  const statsByPlayer =
    idsNeedingFetch.length > 0
      ? await loadStatsByPlayerIds(statsCollection, idsNeedingFetch, seasonIds, pickFields)
      : {};

  const players = filterFgcSelectablePlayers(
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

  return { players, league: L, seasonPair };
}

/** Charge d'abord le roster (stats embarquées), puis enrichit avec la saison précédente. */
export async function loadFgcPlayersProgressive({ league, homeAbbr, awayAbbr, onRosterReady }) {
  const first = await loadFgcPlayersWithSeasonStats({
    league,
    homeAbbr,
    awayAbbr,
    includePreviousSeason: false,
  });

  if (typeof onRosterReady === "function") {
    onRosterReady(first.players, first.seasonPair);
  }

  const full = await loadFgcPlayersWithSeasonStats({
    league,
    homeAbbr,
    awayAbbr,
    includePreviousSeason: true,
  });

  return full;
}
