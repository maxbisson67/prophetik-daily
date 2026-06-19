/** Used when Firestore standings are empty or unavailable. */
import { NHL_ABBR_TO_TEAM_ID, resolveNhlTeamId } from "@src/nhl/nhlTeamIds";

export const NHL_FALLBACK_TEAMS = [
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.ANA, abbreviation: "ANA", name: "Anaheim Ducks" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.BOS, abbreviation: "BOS", name: "Boston Bruins" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.BUF, abbreviation: "BUF", name: "Buffalo Sabres" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.CAR, abbreviation: "CAR", name: "Carolina Hurricanes" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.CBJ, abbreviation: "CBJ", name: "Columbus Blue Jackets" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.CGY, abbreviation: "CGY", name: "Calgary Flames" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.CHI, abbreviation: "CHI", name: "Chicago Blackhawks" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.COL, abbreviation: "COL", name: "Colorado Avalanche" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.DAL, abbreviation: "DAL", name: "Dallas Stars" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.DET, abbreviation: "DET", name: "Detroit Red Wings" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.EDM, abbreviation: "EDM", name: "Edmonton Oilers" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.FLA, abbreviation: "FLA", name: "Florida Panthers" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.LAK, abbreviation: "LAK", name: "Los Angeles Kings" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.MIN, abbreviation: "MIN", name: "Minnesota Wild" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.MTL, abbreviation: "MTL", name: "Montréal Canadiens" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.NJD, abbreviation: "NJD", name: "New Jersey Devils" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.NSH, abbreviation: "NSH", name: "Nashville Predators" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.NYI, abbreviation: "NYI", name: "New York Islanders" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.NYR, abbreviation: "NYR", name: "New York Rangers" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.OTT, abbreviation: "OTT", name: "Ottawa Senators" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.PHI, abbreviation: "PHI", name: "Philadelphia Flyers" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.PIT, abbreviation: "PIT", name: "Pittsburgh Penguins" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.SEA, abbreviation: "SEA", name: "Seattle Kraken" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.SJS, abbreviation: "SJS", name: "San Jose Sharks" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.STL, abbreviation: "STL", name: "St. Louis Blues" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.TBL, abbreviation: "TBL", name: "Tampa Bay Lightning" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.TOR, abbreviation: "TOR", name: "Toronto Maple Leafs" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.UTA, abbreviation: "UTA", name: "Utah Mammoth" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.VAN, abbreviation: "VAN", name: "Vancouver Canucks" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.VGK, abbreviation: "VGK", name: "Vegas Golden Knights" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.WPG, abbreviation: "WPG", name: "Winnipeg Jets" },
  { sport: "NHL", teamId: NHL_ABBR_TO_TEAM_ID.WSH, abbreviation: "WSH", name: "Washington Capitals" },
];

export const MLB_FALLBACK_TEAMS = [
  { sport: "MLB", teamId: "109", abbreviation: "AZ", name: "Arizona Diamondbacks" },
  { sport: "MLB", teamId: "144", abbreviation: "ATL", name: "Atlanta Braves" },
  { sport: "MLB", teamId: "110", abbreviation: "BAL", name: "Baltimore Orioles" },
  { sport: "MLB", teamId: "111", abbreviation: "BOS", name: "Boston Red Sox" },
  { sport: "MLB", teamId: "112", abbreviation: "CHC", name: "Chicago Cubs" },
  { sport: "MLB", teamId: "145", abbreviation: "CWS", name: "Chicago White Sox" },
  { sport: "MLB", teamId: "113", abbreviation: "CIN", name: "Cincinnati Reds" },
  { sport: "MLB", teamId: "114", abbreviation: "CLE", name: "Cleveland Guardians" },
  { sport: "MLB", teamId: "115", abbreviation: "COL", name: "Colorado Rockies" },
  { sport: "MLB", teamId: "116", abbreviation: "DET", name: "Detroit Tigers" },
  { sport: "MLB", teamId: "117", abbreviation: "HOU", name: "Houston Astros" },
  { sport: "MLB", teamId: "118", abbreviation: "KC", name: "Kansas City Royals" },
  { sport: "MLB", teamId: "108", abbreviation: "LAA", name: "Los Angeles Angels" },
  { sport: "MLB", teamId: "119", abbreviation: "LAD", name: "Los Angeles Dodgers" },
  { sport: "MLB", teamId: "146", abbreviation: "MIA", name: "Miami Marlins" },
  { sport: "MLB", teamId: "158", abbreviation: "MIL", name: "Milwaukee Brewers" },
  { sport: "MLB", teamId: "142", abbreviation: "MIN", name: "Minnesota Twins" },
  { sport: "MLB", teamId: "121", abbreviation: "NYM", name: "New York Mets" },
  { sport: "MLB", teamId: "147", abbreviation: "NYY", name: "New York Yankees" },
  { sport: "MLB", teamId: "133", abbreviation: "ATH", name: "Athletics" },
  { sport: "MLB", teamId: "133", abbreviation: "OAK", name: "Athletics" },
  { sport: "MLB", teamId: "143", abbreviation: "PHI", name: "Philadelphia Phillies" },
  { sport: "MLB", teamId: "134", abbreviation: "PIT", name: "Pittsburgh Pirates" },
  { sport: "MLB", teamId: "135", abbreviation: "SD", name: "San Diego Padres" },
  { sport: "MLB", teamId: "137", abbreviation: "SF", name: "San Francisco Giants" },
  { sport: "MLB", teamId: "136", abbreviation: "SEA", name: "Seattle Mariners" },
  { sport: "MLB", teamId: "138", abbreviation: "STL", name: "St. Louis Cardinals" },
  { sport: "MLB", teamId: "139", abbreviation: "TB", name: "Tampa Bay Rays" },
  { sport: "MLB", teamId: "140", abbreviation: "TEX", name: "Texas Rangers" },
  { sport: "MLB", teamId: "141", abbreviation: "TOR", name: "Toronto Blue Jays" },
  { sport: "MLB", teamId: "120", abbreviation: "WSH", name: "Washington Nationals" },
];

export function getFallbackTeams(sport) {
  const s = String(sport || "").toUpperCase();
  if (s === "NHL") return NHL_FALLBACK_TEAMS;
  if (s === "MLB") return MLB_FALLBACK_TEAMS;
  return [];
}

export function lookupTeamByAbbr(sport, abbr) {
  const s = String(sport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const a = String(abbr || "").trim().toUpperCase();
  if (!a) return null;

  const found = getFallbackTeams(s).find((t) => t.abbreviation === a);
  if (found) return found;

  if (s === "NHL") {
    return {
      sport: "NHL",
      teamId: resolveNhlTeamId(a, ""),
      abbreviation: a,
      name: a,
    };
  }

  return { sport: "MLB", teamId: "", abbreviation: a, name: a };
}
