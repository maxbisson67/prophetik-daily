/** Niveaux Prophetik dérivés du nombre de badges débloqués (affichage uniquement). */

export const PROPHETIK_LEVEL_TIERS = Object.freeze([
  { id: "recrue", min: 0, max: 4 },
  { id: "prospect", min: 5, max: 9 },
  { id: "veteran", min: 10, max: 19 },
  { id: "allstar", min: 20, max: 39 },
  { id: "legend", min: 40, max: Infinity },
]);

export function getProphetikLevel(unlockedCount) {
  const count = Math.max(0, Number(unlockedCount || 0));

  for (let i = 0; i < PROPHETIK_LEVEL_TIERS.length; i += 1) {
    const tier = PROPHETIK_LEVEL_TIERS[i];
    if (count >= tier.min && count <= tier.max) {
      const next = PROPHETIK_LEVEL_TIERS[i + 1] || null;
      return {
        ...tier,
        index: i,
        isMax: !next,
        nextMin: next ? next.min : null,
      };
    }
  }

  const last = PROPHETIK_LEVEL_TIERS[PROPHETIK_LEVEL_TIERS.length - 1];
  return { ...last, index: PROPHETIK_LEVEL_TIERS.length - 1, isMax: true, nextMin: null };
}

/** Progression globale vers la collection complète de badges (ex. 2/12 → 17 %). */
export function getOverallBadgeProgress(unlockedCount, totalCount) {
  const unlocked = Math.max(0, Number(unlockedCount || 0));
  const total = Math.max(1, Number(totalCount || 1));
  const pct = Math.min(100, Math.round((unlocked / total) * 100));
  return { unlocked, total, pct };
}

/** Progression vers le prochain palier de niveau. */
export function getLevelTierProgress(unlockedCount) {
  const count = Math.max(0, Number(unlockedCount || 0));
  const level = getProphetikLevel(count);

  if (level.isMax) {
    return { pct: 100, currentInTier: count - level.min, tierSize: 1 };
  }

  const tierSize = level.nextMin - level.min;
  const currentInTier = count - level.min;
  const pct = Math.min(100, Math.round((currentInTier / tierSize) * 100));

  return { pct, currentInTier, tierSize, badgesUntilNext: level.nextMin - count };
}
