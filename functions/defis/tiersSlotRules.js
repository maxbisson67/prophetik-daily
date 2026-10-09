/** Trio 3×3 : exclusion par rang selon le slot (aligné client tiersRules.js). */

export function usesRankSlotExclusion(defiType) {
  return Number(defiType) === 3;
}

export function rankExcludeTopForSlot(slotIndex, defiType) {
  if (!usesRankSlotExclusion(defiType)) return null;
  const slot = Number(slotIndex);
  if (slot === 0) return 0;
  if (slot === 1) return 10;
  if (slot === 2) return 20;
  return 20;
}

export function isPlayerEligibleForSlot(player, slotIndex, defiType) {
  const excludeTop = rankExcludeTopForSlot(slotIndex, defiType);
  if (excludeTop == null || excludeTop <= 0) return true;
  const rank = Number(player?.rank);
  if (!Number.isFinite(rank) || rank <= 0) return true;
  return rank > excludeTop;
}
