/** MLB Stats API team id → canonical Prophetik abbreviation. */
export const MLB_TEAM_ID_TO_ABBR = {
  108: "LAA",
  109: "AZ",
  110: "BAL",
  111: "BOS",
  112: "CHC",
  113: "CIN",
  114: "CLE",
  115: "COL",
  116: "DET",
  117: "HOU",
  118: "KC",
  119: "LAD",
  120: "WSH",
  121: "NYM",
  133: "ATH",
  134: "PIT",
  135: "SD",
  136: "SEA",
  137: "SF",
  138: "STL",
  139: "TB",
  140: "TEX",
  141: "TOR",
  142: "MIN",
  143: "PHI",
  144: "ATL",
  145: "CWS",
  146: "MIA",
  147: "NYY",
  158: "MIL",
};

/** Canonical Prophetik abbreviation → MLB Stats API team id. */
export const MLB_ABBR_TO_TEAM_ID = Object.fromEntries(
  Object.entries(MLB_TEAM_ID_TO_ABBR).map(([id, abbr]) => [abbr, Number(id)])
);

export function mlbTeamIdFromAbbr(abbr) {
  const key = String(abbr ?? "")
    .trim()
    .toUpperCase();
  return MLB_ABBR_TO_TEAM_ID[key] ?? null;
}

export function resolveMlbAbbrFromTeam(team = {}) {
  const fromApi = String(
    team?.abbreviation || team?.teamCode || team?.fileCode || team?.clubName || ""
  )
    .trim()
    .toUpperCase();

  if (fromApi) return fromApi;

  const id = team?.id != null ? Number(team.id) : null;
  if (id && MLB_TEAM_ID_TO_ABBR[id]) return MLB_TEAM_ID_TO_ABBR[id];

  return "";
}
