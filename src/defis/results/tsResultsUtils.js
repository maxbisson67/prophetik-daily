export function emptyLiveStats() {
  return {
    playerGoals: {},
    playerHits: {},
    playerRbi: {},
    playerHomeRuns: {},
    playerA1: {},
    playerA2: {},
    playerAssists: {},
    playerPoints: {},
  };
}

export function normalizeLiveStatsDoc(data = {}) {
  return {
    playerGoals: data.playerGoals || {},
    playerHits: data.playerHits || data.playerGoals || {},
    playerRbi: data.playerRbi || data.playerAssists || {},
    playerHomeRuns: data.playerHomeRuns || {},
    playerA1: data.playerA1 || {},
    playerA2: data.playerA2 || {},
    playerAssists: data.playerAssists || data.assists || {},
    playerPoints: data.playerPoints || {},
  };
}

export function normPlayerId(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

export function formatPlayerLastName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/);
  return parts[parts.length - 1] || s;
}

export function resolveTsSport(defiRaw = {}, fallback = "NHL") {
  return String(defiRaw?.sport || defiRaw?.poolSport || fallback).toUpperCase();
}

export function toDateAny(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function resolveTsHideOthersPicks(defiRaw = {}) {
  const status = String(defiRaw?.status || "").toLowerCase();
  const firstGame = toDateAny(defiRaw?.firstGameUTC);
  const beforeFirstGame = firstGame ? Date.now() < firstGame.getTime() : false;
  return status === "open" && beforeFirstGame;
}

export function buildLeaderboard(participations = []) {
  const rows = [...participations].sort(
    (a, b) => Number(b.livePoints || 0) - Number(a.livePoints || 0)
  );
  if (!rows.length) return [];
  const top = Number(rows[0].livePoints || 0);
  return rows.map((r, index) => ({
    ...r,
    rank: index + 1,
    isTiedForFirst: Number(r.livePoints || 0) === top,
  }));
}

export function buildParticipantPickRows({
  picks = [],
  liveStats = {},
  playerMap = {},
  isMlbTs = false,
}) {
  const rows = [];
  const seen = new Set();

  for (const p of picks) {
    const pid = normPlayerId(p?.playerId ?? p?.id ?? p?.nhlId ?? p?.player?.id);
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);

    const goals = isMlbTs
      ? Number(liveStats.playerHits?.[pid] ?? liveStats.playerGoals?.[pid] ?? 0)
      : Number(liveStats.playerGoals?.[pid] || 0);
    const a1 = Number(liveStats.playerA1?.[pid] || 0);
    const a2 = Number(liveStats.playerA2?.[pid] || 0);
    const assists = isMlbTs
      ? Number(liveStats.playerRbi?.[pid] ?? liveStats.playerAssists?.[pid] ?? 0)
      : Number(liveStats.playerAssists?.[pid] || 0);
    const homeRuns = isMlbTs ? Number(liveStats.playerHomeRuns?.[pid] || 0) : 0;
    const ptsFromLive = Number(liveStats.playerPoints?.[pid] || 0);

    const derived = Math.max(0, ptsFromLive - goals);
    const assistTotal = isMlbTs ? assists : Math.max(a1 + a2, assists, derived);
    const points = isMlbTs ? ptsFromLive || goals + assistTotal + homeRuns : goals + assistTotal;

    const rawName =
      playerMap[pid]?.fullName ?? p?.fullName ?? p?.name ?? p?.playerName ?? "";
    const playerName = String(rawName || "").trim()
      ? formatPlayerLastName(rawName)
      : "Joueur";

    rows.push({
      playerId: pid,
      playerName,
      teamAbbr: playerMap[pid]?.teamAbbr ?? p?.teamAbbr ?? "",
      goals,
      assists: assistTotal,
      homeRuns,
      points,
    });
  }

  rows.sort(
    (a, b) =>
      Number(b.points || 0) - Number(a.points || 0) ||
      Number(b.goals || 0) - Number(a.goals || 0) ||
      a.playerName.localeCompare(b.playerName)
  );

  return rows;
}

export function formatPickStatLine(row, isMlbTs) {
  const goals = Number(row?.goals) || 0;
  const assists = Number(row?.assists) || 0;
  const homeRuns = Number(row?.homeRuns) || 0;
  const points = Number(row?.points) || (isMlbTs ? goals + assists + homeRuns : goals + assists);
  return isMlbTs ? `${goals}-${assists}-${homeRuns}=${points}` : `${goals}-${assists}=${points}`;
}

export function splitEvenPot(total, winnerCount) {
  const n = Math.max(1, Number(winnerCount) || 1);
  const pot = Number(total) || 0;
  if (pot <= 0) return 0;
  return Math.floor(pot / n);
}

export function isTsFinalizedStatus(status, defiRaw = {}) {
  const st = String(status || defiRaw?.status || "").toLowerCase();
  if (st === "completed" || st === "closed") return true;
  if (defiRaw?.payoutAppliedAt) return true;
  if (defiRaw?.completedAt) return true;
  return false;
}

export function isTsLiveLeaderboardStatus(status) {
  const st = String(status || "").toLowerCase();
  return st === "live" || st === "locked" || st === "awaiting_result";
}

/** Résumé du leader en direct (un seul en tête ou égalité). */
export function resolveTsLiveLeaderSummary(leaderboard = [], namesMap = {}, currentUid = "") {
  const rows = Array.isArray(leaderboard) ? leaderboard.filter(Boolean) : [];
  if (!rows.length) return null;

  const topScore = rows.reduce(
    (max, row) => Math.max(max, Number(row.livePoints || 0)),
    Number.NEGATIVE_INFINITY
  );
  if (!Number.isFinite(topScore)) return null;

  const leaders = rows.filter((row) => Number(row.livePoints || 0) === topScore);
  if (leaders.length > 1) {
    return { kind: "tie" };
  }

  const uid = String(leaders[0]?.uid || "");
  const isYou = !!uid && uid === String(currentUid || "");
  const name = isYou ? null : namesMap[uid] || uid || null;

  if (!isYou && !name) return null;

  return { kind: "single", name, score: topScore, isYou };
}

function normalizeWinnerUid(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const uid = value.trim();
    return uid || null;
  }
  if (typeof value === "object") {
    const uid = String(value.uid || value.userId || value.id || "").trim();
    return uid || null;
  }
  return null;
}

function extractOfficialWinnerUids(defiRaw = {}) {
  if (!Array.isArray(defiRaw?.winners)) return [];
  return defiRaw.winners.map(normalizeWinnerUid).filter(Boolean);
}

function deriveWinnerUidsFromLeaderboard(leaderboard = []) {
  const rows = Array.isArray(leaderboard) ? leaderboard.filter(Boolean) : [];
  if (!rows.length) return [];

  const top = rows.reduce(
    (max, row) => Math.max(max, Number(row.finalPoints ?? row.livePoints ?? 0)),
    Number.NEGATIVE_INFINITY
  );
  if (!Number.isFinite(top)) return [];

  return rows
    .filter((row) => Number(row.finalPoints ?? row.livePoints ?? 0) === top)
    .map((row) => String(row.uid || ""))
    .filter(Boolean);
}

function resolveWinnerDisplayName(uid, namesMap = {}) {
  const id = String(uid || "");
  if (!id) return "";
  if (id.toLowerCase() === "ai") {
    return namesMap[id] || "Nova";
  }
  return namesMap[id] || id;
}

/** Résumé gagnant(s) TS pour le badge « Mes résultats » (officiel + repli classement). */
export function resolveTsWinnerBadge(defiRaw = {}, leaderboard = [], namesMap = {}) {
  const status = String(defiRaw?.status || "").toLowerCase();
  const isFinalized = isTsFinalizedStatus(status, defiRaw);

  const officialWinners = extractOfficialWinnerUids(defiRaw);
  const derivedWinners = deriveWinnerUidsFromLeaderboard(leaderboard);
  const winnerUids = derivedWinners.length ? derivedWinners : officialWinners;

  if (!isFinalized || !winnerUids.length) return null;

  const rows = Array.isArray(leaderboard) ? leaderboard.filter(Boolean) : [];
  const pot = Number(defiRaw?.pot ?? 0);
  const bonusPerWinner = Number(defiRaw?.bonusPerWinner ?? 0);
  const winnerShares =
    defiRaw?.winnerShares && typeof defiRaw.winnerShares === "object" ? defiRaw.winnerShares : {};

  const winners = winnerUids.map((uid) => {
    const row = rows.find((r) => String(r.uid) === String(uid));
    const score = Number(row?.finalPoints ?? row?.livePoints ?? 0);
    let share = Number(winnerShares[uid] ?? 0);
    if (share <= 0 && row?.payout != null) {
      share = Number(row.payout) || 0;
    }
    if (share <= 0 && pot > 0) {
      share = splitEvenPot(pot, winnerUids.length);
    }
    const bonus = Number(row?.bonus ?? 0) || (bonusPerWinner > 0 ? bonusPerWinner : 0);
    const payout = share + bonus;
    return {
      uid,
      name: resolveWinnerDisplayName(uid, namesMap),
      score,
      share,
      payout,
    };
  });

  if (!winners.length) return null;

  const humanWinners = winners.filter((w) => String(w.uid).toLowerCase() !== "ai");
  const displayWinners = humanWinners.length ? humanWinners : winners;

  if (displayWinners.length === 1) {
    const w = displayWinners[0];
    return { kind: "single", name: w.name, score: w.score, payout: w.payout };
  }

  const sharePerWinner =
    displayWinners[0]?.payout ?? displayWinners[0]?.share ?? splitEvenPot(pot, displayWinners.length);
  return { kind: "multiple", count: displayWinners.length, sharePerWinner };
}
