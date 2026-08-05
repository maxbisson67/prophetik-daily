import {
  isSlotDecided,
  lookupPickByGameId,
  resolveTpPickResult,
  scoreTpPickAgainstLive,
} from "@src/defis/tpBundleDisplayHelpers";
import { DAILY_TOP_BONUS_POINTS } from "@src/lib/challengeScoringConstants";
import { resolveFgcEntryPoints } from "@src/fgc/resolveFgcEntryPoints";

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function readPickResults(entry = {}) {
  const pickResults = { ...(entry.pickResults || {}) };
  for (const [key, value] of Object.entries(entry)) {
    if (!key.startsWith("pickResults.")) continue;
    if (!value || typeof value !== "object") continue;
    pickResults[key.slice("pickResults.".length)] = value;
  }
  return pickResults;
}

export function parseFgcEntryPoints(entry = {}) {
  return resolveFgcEntryPoints(entry);
}

export function parseTpEntryPoints(entry = {}) {
  const pickResults = readPickResults(entry);

  let pointsFromResults = 0;
  for (const result of Object.values(pickResults)) {
    if (!result || typeof result !== "object") continue;
    pointsFromResults += toNumber(result.points, 0);
  }

  const totalFromField = toNumber(entry.totalPoints, 0);
  return pointsFromResults > 0 ? Math.max(totalFromField, pointsFromResults) : totalFromField;
}

export function parseTpEntryPointsWithLive(entry = {}, bundle = {}, liveScoresByGameId = {}) {
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  if (!games.length) return parseTpEntryPoints(entry);

  const picks = entry?.picks || {};
  const pickResults = readPickResults(entry);
  let total = 0;

  for (const slot of games) {
    const gameId = String(slot?.gameId || "").trim();
    if (!gameId) continue;

    const pick = lookupPickByGameId(picks, gameId);
    if (!pick) continue;

    const stored = lookupPickByGameId(pickResults, gameId);

    if (isSlotDecided(slot)) {
      const result = resolveTpPickResult({ pick, slot, pickResult: stored, bundle });
      if (result) total += toNumber(result.points, 0);
      continue;
    }

    const liveGame = liveScoresByGameId?.[gameId] || null;
    const liveResult = scoreTpPickAgainstLive(pick, slot, liveGame, bundle);
    if (liveResult?.winnerCorrect) {
      total += toNumber(liveResult.points, 0);
    } else if (stored) {
      total += toNumber(stored.points, 0);
    }
  }

  return Math.max(parseTpEntryPoints(entry), total);
}

export function isTsDefiFinalized(tsDefi = {}, tsEntries = []) {
  const status = String(tsDefi?.status || "").toLowerCase();
  if (["completed", "closed", "finalized", "decided"].includes(status)) return true;
  return (tsEntries || []).some((entry) => !!entry?.finalizedAt);
}

/** Cumul des 3 joueurs (sans bonus gagnant Trio — le bonus est quotidien). */
export function parseTsParticipationScores(entry = {}, { tsFinalized = false } = {}) {
  const tsLivePoints = toNumber(entry.livePoints ?? entry.finalPoints, 0);
  const tsPoints = tsFinalized ? tsLivePoints : tsLivePoints;

  return {
    tsLivePoints,
    tsBonusPoints: 0,
    tsPotPoints: 0,
    tsPoints,
    tsFinalized,
  };
}

function baseRowTotal(row = {}) {
  return (
    toNumber(row.fgcPoints) +
    toNumber(row.tpPoints) +
    toNumber(row.tsPoints)
  );
}

export function resolveDailyTopScorerUids(rows = []) {
  const scored = (rows || [])
    .map((row) => ({
      uid: String(row.uid || ""),
      total: baseRowTotal(row),
    }))
    .filter((row) => row.uid && row.total > 0);

  if (!scored.length) return [];

  const maxTotal = Math.max(...scored.map((row) => row.total));
  return scored.filter((row) => row.total === maxTotal).map((row) => row.uid);
}

export function applyDailyTopBonusToRows(
  rows = [],
  {
    dailyBonusAward = null,
    dailyTopScorerPush = null,
    bonusPoints = DAILY_TOP_BONUS_POINTS,
    inferWhenMissing = false,
  } = {}
) {
  if (!rows.length) return rows;

  const awardFinalized = !!dailyBonusAward?.awardedAt;
  const bonusPts = toNumber(dailyBonusAward?.bonusPoints, bonusPoints);

  let winnerUids = Array.isArray(dailyBonusAward?.winnerUids)
    ? dailyBonusAward.winnerUids.map(String).filter(Boolean)
    : [];

  if (!winnerUids.length && Array.isArray(dailyTopScorerPush?.winnerUids)) {
    winnerUids = dailyTopScorerPush.winnerUids.map(String).filter(Boolean);
  }

  if (!winnerUids.length && inferWhenMissing) {
    winnerUids = resolveDailyTopScorerUids(rows);
  }

  const showBonus = awardFinalized || inferWhenMissing || !!dailyTopScorerPush?.sentAt;

  const enriched = rows.map((row) => {
    const baseTotal = baseRowTotal(row);
    const isDailyTopScorer = winnerUids.includes(String(row.uid));
    const dailyBonusPoints =
      showBonus && isDailyTopScorer && bonusPts > 0 ? bonusPts : 0;

    return {
      ...row,
      baseTotalPoints: baseTotal,
      dailyBonusPoints,
      isDailyTopScorer,
      totalPoints: baseTotal + dailyBonusPoints,
    };
  });

  enriched.sort((a, b) => {
    const diff = toNumber(b.totalPoints) - toNumber(a.totalPoints);
    if (diff !== 0) return diff;
    return String(a.displayName || a.uid).localeCompare(String(b.displayName || b.uid), "fr");
  });

  return enriched;
}

export function mergeParticipantRows({
  fgcEntries = [],
  tpEntries = [],
  tsEntries = [],
  tpBundle = null,
  liveScoresByGameId = {},
  tsDefi = null,
  dailyBonusAward = null,
  dailyTopScorerPush = null,
  inferDailyBonus = false,
}) {
  const byUid = new Map();

  const touch = (uid, patch = {}) => {
    const id = String(uid || "").trim();
    if (!id) return;
    const prev = byUid.get(id) || {
      uid: id,
      displayName: null,
      avatarUrl: null,
      fgcPoints: 0,
      tpPoints: 0,
      tsPoints: 0,
      tsPotPoints: 0,
      tsBonusPoints: 0,
      tsLivePoints: 0,
      tsFinalized: false,
      dailyBonusPoints: 0,
      totalPoints: 0,
    };
    byUid.set(id, {
      ...prev,
      ...patch,
      displayName: patch.displayName || prev.displayName || null,
      avatarUrl: patch.avatarUrl || prev.avatarUrl || null,
      fgcPoints: Math.max(prev.fgcPoints, patch.fgcPoints ?? prev.fgcPoints),
      tpPoints: Math.max(prev.tpPoints, patch.tpPoints ?? prev.tpPoints),
      tsPoints: Math.max(prev.tsPoints, patch.tsPoints ?? prev.tsPoints),
      tsPotPoints: Math.max(prev.tsPotPoints, patch.tsPotPoints ?? prev.tsPotPoints),
      tsBonusPoints: Math.max(prev.tsBonusPoints, patch.tsBonusPoints ?? prev.tsBonusPoints),
      tsLivePoints: Math.max(prev.tsLivePoints, patch.tsLivePoints ?? prev.tsLivePoints),
      tsFinalized: patch.tsFinalized ?? prev.tsFinalized,
    });
  };

  const tsFinalized = isTsDefiFinalized(tsDefi, tsEntries);

  for (const entry of fgcEntries) {
    const uid = String(entry.uid || entry.id || "").trim();
    if (!uid) continue;
    touch(uid, {
      displayName: entry.displayName || null,
      avatarUrl: entry.avatarUrl || null,
      fgcPoints: parseFgcEntryPoints(entry),
    });
  }

  for (const entry of tpEntries) {
    const uid = String(entry.uid || entry.id || "").trim();
    if (!uid) continue;
    touch(uid, {
      displayName: entry.displayName || null,
      avatarUrl: entry.avatarUrl || null,
      tpPoints: parseTpEntryPointsWithLive(entry, tpBundle, liveScoresByGameId),
    });
  }

  for (const entry of tsEntries) {
    const uid = String(entry.uid || entry.id || "").trim();
    if (!uid) continue;
    const tsScores = parseTsParticipationScores(entry, { tsFinalized });
    touch(uid, {
      displayName: entry.displayName || null,
      avatarUrl: entry.avatarUrl || null,
      ...tsScores,
    });
  }

  return applyDailyTopBonusToRows([...byUid.values()], {
    dailyBonusAward,
    dailyTopScorerPush,
    inferWhenMissing: inferDailyBonus,
  });
}
