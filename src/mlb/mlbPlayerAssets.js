export function mlbHeadshotUrl(playerId) {
  const id = String(playerId || "").trim();
  if (!id) return null;

  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/${id}/headshot/67/current`;
}

export function resolveDefiHeadshotUrl(sport, teamAbbr, playerId) {
  const s = String(sport || "NHL").toUpperCase();
  if (s === "MLB") return mlbHeadshotUrl(playerId);

  const abbr = String(teamAbbr || "").toUpperCase();
  const pid = String(playerId || "").trim();
  if (!abbr || !pid) return null;

  return `https://assets.nhle.com/mugs/nhl/20252026/${abbr}/${pid}.png`;
}
