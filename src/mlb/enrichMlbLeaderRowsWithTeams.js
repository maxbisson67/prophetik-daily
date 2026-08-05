import firestore from "@react-native-firebase/firestore";
import { lookupMlbTeamById, lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

const PLAYER_CHUNK = 30;

function needsTeamEnrich(row = {}) {
  return !String(row?.teamId || "").trim();
}

async function fetchPlayerChunk(chunkIds) {
  const refs = chunkIds.map((id) => firestore().doc(`mlb_players/${id}`));
  const snaps =
    typeof firestore().getAll === "function"
      ? await firestore().getAll(...refs)
      : await Promise.all(refs.map((r) => r.get()));

  const byId = {};
  snaps.forEach((snap) => {
    if (!snap.exists) return;
    byId[snap.id] = snap.data() || {};
  });
  return byId;
}

/** Complète teamId / teamAbbr depuis mlb_players ou le catalogue fallback. */
export async function enrichMlbLeaderRowsWithTeams(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  const missingIds = [
    ...new Set(
      rows
        .filter(needsTeamEnrich)
        .map((r) => String(r?.playerId || "").trim())
        .filter(Boolean)
    ),
  ];

  const playerById = {};
  for (let i = 0; i < missingIds.length; i += PLAYER_CHUNK) {
    const chunk = missingIds.slice(i, i + PLAYER_CHUNK);
    Object.assign(playerById, await fetchPlayerChunk(chunk));
  }

  return rows.map((row) => {
    const playerId = String(row?.playerId || "").trim();
    let teamId = String(row?.teamId || "").trim();
    let teamAbbr = String(row?.teamAbbr || "").trim().toUpperCase();

    if (!teamId && !teamAbbr) {
      const player = playerById[playerId] || {};
      teamId = String(player?.teamId || "").trim();
      teamAbbr = String(player?.teamAbbr || "").trim().toUpperCase();
    }

    if (teamId && !teamAbbr) {
      teamAbbr = String(lookupMlbTeamById(teamId)?.abbreviation || "").toUpperCase();
    }

    if (!teamId && teamAbbr) {
      teamId = String(lookupTeamByAbbr("MLB", teamAbbr)?.teamId || "").trim();
    }

    if (teamId === String(row?.teamId || "").trim() && teamAbbr === String(row?.teamAbbr || "").trim().toUpperCase()) {
      return row;
    }

    return {
      ...row,
      ...(teamId ? { teamId } : {}),
      ...(teamAbbr ? { teamAbbr } : {}),
    };
  });
}
