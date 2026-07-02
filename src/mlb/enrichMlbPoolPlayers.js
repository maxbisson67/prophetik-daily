import firestore from "@react-native-firebase/firestore";
import { resolvePlayerBattingAverage } from "./mlbBattingAverage";

const STATS_CHUNK = 30;

export async function enrichMlbPoolPlayers(list, seasonId) {
  if (!Array.isArray(list) || !list.length || !seasonId) return list;

  const statsById = {};
  const refs = list.map((p) =>
    firestore().doc(`mlb_player_stats_current/${seasonId}_${p.playerId}`)
  );

  for (let i = 0; i < refs.length; i += STATS_CHUNK) {
    const chunkRefs = refs.slice(i, i + STATS_CHUNK);
    const chunkPlayers = list.slice(i, i + STATS_CHUNK);

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
  }

  return list.map((p) => {
    const st = statsById[String(p.playerId)];
    return {
      ...p,
      battingAverage: resolvePlayerBattingAverage(p, st),
      atBats: Number(p.atBats) || Number(st?.atBats) || 0,
      hits: Number(p.hits) || Number(st?.hits) || 0,
    };
  });
}
