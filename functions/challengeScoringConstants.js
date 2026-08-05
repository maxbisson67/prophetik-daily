/** Points attribués pour une victoire FGC (premier but / premier point produit). */
export const FGC_WIN_POINTS = 10;

/** @deprecated Le bonus Trio est remplacé par le bonus quotidien cumulatif. */
export const TS_WIN_BONUS_POINTS = 0;

/** Bonus pour le plus haut total SOLO + DUO + TRIO de la soirée. */
export const DAILY_TOP_BONUS_POINTS = 5;

/** Barème TP par défaut : bonne équipe + bonus score exact. */
export const TP_WINNER_BASE_POINTS = 5;
export const TP_EXACT_SCORE_BONUS_POINTS = 5;

export const TP_DEFAULT_SCORING = {
  winnerBasePoints: TP_WINNER_BASE_POINTS,
  exactScoreBonusPoints: TP_EXACT_SCORE_BONUS_POINTS,
  riskScoringEnabled: false,
  riskPoints: {
    logical: 3,
    mixed: 5,
    risky: 10,
  },
};
