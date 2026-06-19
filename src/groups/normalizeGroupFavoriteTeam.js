import { resolveNhlTeamId } from "@src/nhl/nhlTeamIds";

export function normalizeGroupFavoriteTeam(sport, favoriteTeam) {
  const normalizedSport = String(sport || "NHL").trim().toUpperCase() === "MLB" ? "MLB" : "NHL";

  if (!favoriteTeam || typeof favoriteTeam !== "object") {
    return null;
  }

  const abbreviation = String(favoriteTeam.abbreviation || "").trim();
  const name = String(favoriteTeam.name || "").trim();
  let teamId = String(favoriteTeam.teamId || "").trim();

  if (!abbreviation || !name) {
    return null;
  }

  if (normalizedSport === "NHL") {
    teamId = resolveNhlTeamId(abbreviation, teamId);
  }

  if (!teamId) {
    return null;
  }

  return {
    sport: normalizedSport,
    teamId,
    abbreviation,
    name,
  };
}
