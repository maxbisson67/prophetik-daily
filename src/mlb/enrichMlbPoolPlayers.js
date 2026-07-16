import firestore from "@react-native-firebase/firestore";
import { resolvePlayerBattingAverage } from "./mlbBattingAverage";

const STATS_CHUNK = 30;

export function poolHasEmbeddedMlbStats(list) {
  if (!Array.isArray(list) || !list.length) return false;
  const withSlg = list.filter((p) => p?.slg != null || p?.sluggingPercentage != null).length;
  return withSlg >= Math.min(list.length, 3);
}

async function fetchStatsChunk(chunkRefs, chunkPlayers) {
  const statsById = {};
  let snaps = [];
  if (typeof firestore().getAll === "function") {
    snaps = await firestore().getAll(...chunkRefs);
  } else {
    snaps = await Promise.all(chunkRefs.map((r) => r.get()));
  }

  snaps.forEach((s, idx) => {
    if (!s.exists) return;
    const d = s.data() || {};
    const pid = String(chunkPlayers[idx]?.playerId ?? d.playerId ?? "");
    if (pid) statsById[pid] = d;
  });

  return statsById;
}

export async function enrichMlbPoolPlayers(list, seasonId) {
  if (!Array.isArray(list) || !list.length || !seasonId) return list;
  if (poolHasEmbeddedMlbStats(list)) return list;

  const statsById = {};
  const refs = list.map((p) =>
    firestore().doc(`mlb_player_stats_current/${seasonId}_${p.playerId}`)
  );

  const chunkCount = Math.ceil(refs.length / STATS_CHUNK);
  const chunkResults = await Promise.all(
    Array.from({ length: chunkCount }, (_, chunkIdx) => {
      const start = chunkIdx * STATS_CHUNK;
      const chunkRefs = refs.slice(start, start + STATS_CHUNK);
      const chunkPlayers = list.slice(start, start + STATS_CHUNK);
      return fetchStatsChunk(chunkRefs, chunkPlayers);
    })
  );

  for (const partial of chunkResults) {
    Object.assign(statsById, partial);
  }

  return list.map((p) => {
    const st = statsById[String(p.playerId)];
    return {
      ...p,
      battingAverage: resolvePlayerBattingAverage(p, st),
      atBats: Number(p.atBats) || Number(st?.atBats) || 0,
      hits: Number(p.hits) || Number(st?.hits) || 0,
      rbi: Number(p.rbi) || Number(st?.rbi) || 0,
      runs: Number(p.runs) || Number(st?.runs) || 0,
      homeRuns: Number(p.homeRuns) || Number(st?.homeRuns) || 0,
      slg:
        p.slg ??
        p.sluggingPercentage ??
        st?.slg ??
        st?.sluggingPercentage ??
        null,
    };
  });
}
