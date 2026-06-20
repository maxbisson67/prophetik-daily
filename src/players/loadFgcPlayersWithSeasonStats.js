import firestore from "@react-native-firebase/firestore";
import { getSeasonPairForLeague, normalizeStatsBySeason } from "./seasonStatsHelpers";
import { filterFgcSelectablePlayers } from "./fgcPlayerFilters";

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

  const snaps = await Promise.all(refs.map((ref) => ref.get()));

  snaps.forEach((snap, idx) => {
    if (!snap?.exists) return;
    const row = snap.data() || {};
    const { playerId, seasonId } = meta[idx];
    if (!byPlayer[playerId]) byPlayer[playerId] = {};
    byPlayer[playerId][seasonId] = pickFields(row);
  });

  return byPlayer;
}

export async function loadFgcPlayersWithSeasonStats({ league, homeAbbr, awayAbbr }) {
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
  const seasonIds = [seasonPair.current, seasonPair.previous].filter(Boolean);

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

  const statsByPlayer = await loadStatsByPlayerIds(
    statsCollection,
    playerIds,
    seasonIds,
    pickFields
  );

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
