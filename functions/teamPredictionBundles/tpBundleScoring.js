import { TP_DEFAULT_SCORING, safeUpper } from "../teamPredictionChallenges/tpGameSources.js";

export function toNumber(v, def = 0) {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function readScoringConfig(bundle = {}) {
  const scoring = bundle.scoring || {};
  return {
    winnerBasePoints: toNumber(
      scoring.winnerBasePoints,
      TP_DEFAULT_SCORING.winnerBasePoints
    ),
    exactScoreBonusPoints: toNumber(
      scoring.exactScoreBonusPoints,
      TP_DEFAULT_SCORING.exactScoreBonusPoints
    ),
  };
}

export function scorePick(pick = {}, official = {}, scoring = {}) {
  const officialWinner = safeUpper(official?.winnerAbbr);
  const officialAwayScore = toNumber(official?.awayScore, null);
  const officialHomeScore = toNumber(official?.homeScore, null);

  const winnerCorrect = safeUpper(pick?.winnerAbbr) === officialWinner;

  const exactScoreCorrect =
    winnerCorrect &&
    toNumber(pick?.predictedAwayScore, null) === officialAwayScore &&
    toNumber(pick?.predictedHomeScore, null) === officialHomeScore;

  let points = 0;
  if (winnerCorrect) points += scoring.winnerBasePoints;
  if (winnerCorrect && exactScoreCorrect) points += scoring.exactScoreBonusPoints;

  return {
    winnerCorrect,
    exactScoreCorrect,
    points,
    won: winnerCorrect,
    isPerfectPick: winnerCorrect && exactScoreCorrect,
    payout: points,
  };
}

export function deriveWinnerAbbr({ awayAbbr, homeAbbr, awayScore, homeScore }) {
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return null;
  if (awayScore === homeScore) return null;
  return awayScore > homeScore ? safeUpper(awayAbbr) : safeUpper(homeAbbr);
}
