function normalizePitcher(raw) {
  if (!raw?.name) return null;
  return {
    id: raw.id ?? null,
    name: raw.name,
    era: raw.era ?? null,
    wins: raw.wins ?? null,
    losses: raw.losses ?? null,
  };
}

function normalizeTeamSide(abbr, form, pitcher) {
  if (!abbr) return null;
  return {
    abbr,
    form: form || null,
    pitcher: normalizePitcher(pitcher),
  };
}

/**
 * Snapshot vérifié pour la vue Indicateurs Nova (TP MLB).
 * @param {object|null} verifiedContext
 */
export function buildTpIndicatorsMeta(verifiedContext) {
  if (verifiedContext?.domain !== "tp" || verifiedContext?.sport !== "MLB") {
    return null;
  }

  const game = verifiedContext.focusedGame || verifiedContext.games?.[0] || null;
  if (!game) return null;

  return {
    sport: "MLB",
    slot: game.slot ?? null,
    gameId: game.gameId || null,
    awayAbbr: game.awayAbbr || null,
    homeAbbr: game.homeAbbr || null,
    away: normalizeTeamSide(game.awayAbbr, game.teamForm?.away, game.awayPitcher),
    home: normalizeTeamSide(game.homeAbbr, game.teamForm?.home, game.homePitcher),
    participantPick: game.participantPick || null,
  };
}
