function str(v) {
  return String(v ?? "").trim();
}

/**
 * Résout la liste de joueurs et le joueur « focus » pour Nova Coach FGC.
 * Un seul playerId explicite (modal « Avis de Nova ») = focus sur ce joueur uniquement,
 * sans mélanger avec le choix Firestore déjà enregistré.
 */
export function resolveFgcPlayerFocus(playerIds = [], entryPlayerId = null) {
  const requested = [
    ...new Set((Array.isArray(playerIds) ? playerIds : []).map(str).filter(Boolean)),
  ];
  const entryId = str(entryPlayerId);

  if (requested.length === 1) {
    return { ids: requested, focusPlayerId: requested[0] };
  }

  const ids = [...requested];
  if (entryId && !ids.includes(entryId)) {
    ids.unshift(entryId);
  }

  if (!ids.length && entryId) {
    return { ids: [entryId], focusPlayerId: entryId };
  }

  const focusPlayerId = entryId && ids.includes(entryId) ? entryId : ids[0] || null;

  return { ids: ids.slice(0, 3), focusPlayerId };
}

export function buildFgcCurrentPickFromPlayer(player, { batSide = null } = {}) {
  if (!player?.playerId) return null;
  return {
    playerId: str(player.playerId),
    playerName: str(player.fullName) || null,
    teamAbbr: str(player.teamAbbr).toUpperCase() || null,
    isAwayTeam: player.isAwayTeam === true,
    isHomeTeam: player.isHomeTeam === true,
    batSide: batSide || player.batSide || null,
    lineupSlot: player.lineupSlot != null ? Number(player.lineupSlot) : null,
  };
}
