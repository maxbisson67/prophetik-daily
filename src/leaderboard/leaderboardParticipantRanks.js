import { deriveTpExactCount, fgcDisplayPoints } from "./leaderboardDashboardHelpers";

function rowId(row) {
  return String(row?.id || row?.uid || "");
}

function sortByValueDesc(rows, getValue) {
  return [...(rows || [])].sort(
    (a, b) => Number(getValue(b) ?? 0) - Number(getValue(a) ?? 0)
  );
}

/** Rang compétition : ex-aequo partagent le même rang. */
export function buildRankMap(rows, getValue) {
  const sorted = sortByValueDesc(rows, getValue);
  const map = new Map();
  let rank = 0;

  sorted.forEach((row, index) => {
    const value = Number(getValue(row) ?? 0);
    if (index === 0) {
      rank = 1;
    } else {
      const prevValue = Number(getValue(sorted[index - 1]) ?? 0);
      if (value !== prevValue) rank = index + 1;
    }
    map.set(rowId(row), rank);
  });

  return map;
}

export function buildLeaderboardRankMaps(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    overall: buildRankMap(list, (r) => r?.pointsTotal ?? 0),
    fgc: buildRankMap(list, (r) => fgcDisplayPoints(r)),
    tp: buildRankMap(list, (r) => r?.tpPoints ?? 0),
    ts: buildRankMap(list, (r) => r?.tsPoints ?? 0),
  };
}

export function getParticipantRank(rankMap, row) {
  const id = rowId(row);
  if (!id || !rankMap) return null;
  const rank = rankMap.get(id);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

export function buildParticipantChallengeStats(row, rankMaps) {
  const tpExacts = deriveTpExactCount(row);
  const fgcPoints = fgcDisplayPoints(row);
  const tpPoints = Number(row?.tpPoints ?? 0) || 0;
  const tsPoints = Number(row?.tsPoints ?? 0) || 0;

  return {
    overall: {
      rank: getParticipantRank(rankMaps.overall, row),
      points: Number(row?.pointsTotal ?? 0) || 0,
      wins: Number(row?.wins ?? 0) || 0,
    },
    fgc: {
      rank: getParticipantRank(rankMaps.fgc, row),
      points: fgcPoints,
      wins: Number(row?.fgcWins ?? 0) || 0,
    },
    tp: {
      rank: getParticipantRank(rankMaps.tp, row),
      points: tpPoints,
      wins: Number(row?.tpWins ?? 0) || 0,
      exacts: tpExacts,
    },
    ts: {
      rank: getParticipantRank(rankMaps.ts, row),
      points: tsPoints,
      wins: Number(row?.tsWins ?? 0) || 0,
    },
  };
}

export function buildDailyRankMaps(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    overall: buildRankMap(list, (r) => r?.totalPoints ?? 0),
    fgc: buildRankMap(list, (r) => r?.fgcPoints ?? 0),
    tp: buildRankMap(list, (r) => r?.tpPoints ?? 0),
    ts: buildRankMap(list, (r) => r?.tsPoints ?? 0),
  };
}

export function buildDailyParticipantChallengeStats(row, rankMaps) {
  const fgcPoints = Number(row?.fgcPoints ?? 0) || 0;
  const tpPoints = Number(row?.tpPoints ?? 0) || 0;
  const tsPoints = Number(row?.tsPoints ?? 0) || 0;

  return {
    overall: {
      rank: getParticipantRank(rankMaps.overall, row),
      points: Number(row?.totalPoints ?? 0) || 0,
      wins:
        (fgcPoints > 0 ? 1 : 0) +
        (tpPoints > 0 ? 1 : 0) +
        (tsPoints > 0 ? 1 : 0),
    },
    fgc: {
      rank: getParticipantRank(rankMaps.fgc, row),
      points: fgcPoints,
      wins: fgcPoints > 0 ? 1 : 0,
    },
    tp: {
      rank: getParticipantRank(rankMaps.tp, row),
      points: tpPoints,
      wins: tpPoints > 0 ? 1 : 0,
      exacts: 0,
    },
    ts: {
      rank: getParticipantRank(rankMaps.ts, row),
      points: tsPoints,
      wins: tsPoints > 0 ? 1 : 0,
    },
  };
}

export function toDailyProfileRow(row = {}) {
  const uid = String(row?.uid || row?.id || "").trim();
  return {
    ...row,
    id: uid,
    uid,
  };
}
