import { isSlotLocked } from "@src/defis/tpDeadlineHelpers";

export function isSlotDecided(slot) {
  return String(slot?.status || "").toLowerCase() === "decided";
}

/** Statut UI d'un match TP dans Mes résultats : registered | in_progress | completed */
export function resolveTpSlotResultsStatus(slot) {
  const st = String(slot?.status || "open").toLowerCase();
  if (isSlotDecided(slot) || st === "closed") return "completed";
  if (["live", "locked", "pending"].includes(st)) return "in_progress";

  if (st === "open") {
    return isSlotLocked(slot) ? "in_progress" : "registered";
  }

  return "in_progress";
}

export function isBundleDecided(bundle) {
  const status = String(bundle?.status || "").toLowerCase();
  return status === "decided" || status === "closed";
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function toNumber(v, def = 0) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const TP_DEFAULT_SCORING = {
  winnerBasePoints: 3,
  exactScoreBonusPoints: 3,
};

export function readTpScoringConfig(bundle = {}) {
  const scoring = bundle?.scoring || {};
  return {
    winnerBasePoints: toNumber(scoring.winnerBasePoints, TP_DEFAULT_SCORING.winnerBasePoints),
    exactScoreBonusPoints: toNumber(
      scoring.exactScoreBonusPoints,
      TP_DEFAULT_SCORING.exactScoreBonusPoints
    ),
  };
}

export function lookupPickByGameId(map, gameId) {
  if (!map || gameId == null) return null;
  const key = String(gameId);
  if (map[key] != null) return map[key];
  const foundKey = Object.keys(map).find((k) => String(k) === key);
  return foundKey != null ? map[foundKey] : null;
}

function getPredictedWinnerAbbr(pick, awayAbbr, homeAbbr) {
  const away = Number(pick?.predictedAwayScore);
  const home = Number(pick?.predictedHomeScore);

  if (Number.isFinite(away) && Number.isFinite(home)) {
    if (away > home) return safeAbbr(awayAbbr);
    if (home > away) return safeAbbr(homeAbbr);
  }

  return safeAbbr(pick?.winnerAbbr);
}

export function scoreTpPick(pick, slot, bundle) {
  if (!pick || !isSlotDecided(slot)) return null;

  const official = slot?.officialResult || {};
  const officialWinner = safeAbbr(official.winnerAbbr);
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const predictedWinner = getPredictedWinnerAbbr(pick, awayAbbr, homeAbbr);

  const winnerCorrect = !!predictedWinner && predictedWinner === officialWinner;

  const predictedAway = toNumber(pick?.predictedAwayScore, null);
  const predictedHome = toNumber(pick?.predictedHomeScore, null);
  const officialAway = toNumber(official?.awayScore, null);
  const officialHome = toNumber(official?.homeScore, null);

  const exactScoreCorrect =
    winnerCorrect &&
    predictedAway === officialAway &&
    predictedHome === officialHome;

  const scoring = readTpScoringConfig(bundle);
  let points = 0;
  if (winnerCorrect) points += scoring.winnerBasePoints;
  if (exactScoreCorrect) points += scoring.exactScoreBonusPoints;

  return {
    winnerCorrect,
    exactScoreCorrect,
    points,
    payout: points,
  };
}

export function resolveTpPickResult({ pick, slot, pickResult, bundle }) {
  const computed = pick && slot ? scoreTpPick(pick, slot, bundle) : null;
  if (computed) return computed;

  if (pickResult && typeof pickResult.winnerCorrect === "boolean") {
    return pickResult;
  }

  return null;
}

export function countTpPickStatsForEntry(entry, bundle) {
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  const picks = entry?.picks || {};
  const pickResults = entry?.pickResults || {};
  let winnersCorrect = 0;
  let exactScores = 0;

  for (const slot of games) {
    if (!isSlotDecided(slot)) continue;

    const gameId = String(slot.gameId || "");
    const pick = lookupPickByGameId(picks, gameId);
    const stored = lookupPickByGameId(pickResults, gameId);
    const result = resolveTpPickResult({ pick, slot, pickResult: stored, bundle });

    if (!result) continue;
    if (result.winnerCorrect) winnersCorrect += 1;
    if (result.exactScoreCorrect) exactScores += 1;
  }

  return { winnersCorrect, exactScores };
}

export function formatTpPickLine(pick, league = "NHL") {
  if (!pick) return null;
  const away = pick.predictedAwayScore;
  const home = pick.predictedHomeScore;
  if (away == null || home == null) return null;
  const score = `${away}-${home}`;
  const outcome = safeAbbr(pick.predictedOutcome);
  const lg = String(league || "NHL").toUpperCase();

  if (lg === "MLB" || outcome === "FINAL") return score;
  if (outcome === "REG" || outcome === "OT" || outcome === "TB") {
    return `${score} (${outcome})`;
  }
  return score;
}

export function formatOfficialScoreLine(slot) {
  const official = slot?.officialResult || {};
  const away = official.awayScore;
  const home = official.homeScore;
  if (away == null || home == null) return null;
  return `${away}-${home}`;
}

export function formatPickPoints(pickResult) {
  const pts = Number(pickResult?.points ?? pickResult?.payout ?? 0);
  if (!Number.isFinite(pts) || pts <= 0) return null;
  return `+${pts} pt${pts > 1 ? "s" : ""}`;
}

export function getSlotOfficialScores(slot) {
  const official = slot?.officialResult || {};
  return {
    away: official.awayScore != null ? Number(official.awayScore) : null,
    home: official.homeScore != null ? Number(official.homeScore) : null,
  };
}

export function getPickScores(pick) {
  if (!pick) return { away: null, home: null };
  return {
    away: pick.predictedAwayScore != null ? Number(pick.predictedAwayScore) : null,
    home: pick.predictedHomeScore != null ? Number(pick.predictedHomeScore) : null,
  };
}

export function getLiveScores(liveGame) {
  if (!liveGame) return { away: null, home: null };
  return {
    away: liveGame.awayScore != null ? Number(liveGame.awayScore) : null,
    home: liveGame.homeScore != null ? Number(liveGame.homeScore) : null,
  };
}

export function formatOfficialPeriodSuffix(slot, league = "NHL") {
  const lg = String(league || "NHL").toUpperCase();
  if (lg === "MLB") return null;

  const outcome = String(slot?.officialResult?.outcome || "REG").toUpperCase();
  if (outcome === "OT") return "Prolongation";
  if (outcome === "TB" || outcome === "SO") return "TB";
  return null;
}

export function formatResultWinnerLine(slot, league = "NHL") {
  const official = slot?.officialResult || {};
  const winner = String(official.winnerAbbr || "").trim().toUpperCase();
  const score = formatOfficialScoreLine(slot);
  if (!winner || !score) return null;

  const lg = String(league || "NHL").toUpperCase();
  if (lg === "MLB" || String(official.outcome || "").toUpperCase() === "FINAL") {
    return `${winner} ${score}`;
  }

  const outcome = String(official.outcome || "REG").toUpperCase();
  return `${winner} ${score} (${outcome})`;
}

export function formatLiveScoreLine(liveGame) {
  if (!liveGame) return null;
  const away = liveGame.awayScore;
  const home = liveGame.homeScore;
  if (away == null || home == null) return null;
  return `${away}-${home}`;
}

export function scoreTpPickAgainstLive(pick, slot, liveGame, bundle) {
  if (!pick || !liveGame) return null;

  const awayScore = Number(liveGame.awayScore);
  const homeScore = Number(liveGame.homeScore);
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return null;

  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const predictedWinner = getPredictedWinnerAbbr(pick, awayAbbr, homeAbbr);

  let liveWinner = null;
  if (awayScore > homeScore) liveWinner = awayAbbr;
  else if (homeScore > awayScore) liveWinner = homeAbbr;

  const winnerCorrect = !!predictedWinner && !!liveWinner && predictedWinner === liveWinner;

  const predictedAway = toNumber(pick?.predictedAwayScore, null);
  const predictedHome = toNumber(pick?.predictedHomeScore, null);
  const exactScoreCorrect =
    winnerCorrect && predictedAway === awayScore && predictedHome === homeScore;

  const scoring = readTpScoringConfig(bundle);
  let points = 0;
  if (winnerCorrect) points += scoring.winnerBasePoints;
  if (exactScoreCorrect) points += scoring.exactScoreBonusPoints;

  return {
    winnerCorrect,
    exactScoreCorrect,
    points,
    payout: points,
    provisional: true,
  };
}
