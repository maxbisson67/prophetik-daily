const MLB_TWO_WORD_CITY_PREFIXES = [
  "New York",
  "Los Angeles",
  "San Francisco",
  "San Diego",
  "Kansas City",
  "St. Louis",
  "Tampa Bay",
];

const MLB_TEAMS = {
  AZ: "Diamondbacks",
  ATH: "Athletics",
  OAK: "Athletics",
  ATL: "Braves",
  BAL: "Orioles",
  BOS: "Red Sox",
  CHC: "Cubs",
  CWS: "White Sox",
  CIN: "Reds",
  CLE: "Guardians",
  COL: "Rockies",
  DET: "Tigers",
  HOU: "Astros",
  KC: "Royals",
  LAA: "Angels",
  LAD: "Dodgers",
  MIA: "Marlins",
  MIL: "Brewers",
  MIN: "Twins",
  NYM: "Mets",
  NYY: "Yankees",
  PHI: "Phillies",
  PIT: "Pirates",
  SD: "Padres",
  SF: "Giants",
  SEA: "Mariners",
  STL: "Cardinals",
  TB: "Rays",
  TEX: "Rangers",
  TOR: "Blue Jays",
  WSH: "Nationals",
};

const NHL_TEAMS = {
  ANA: "Ducks",
  BOS: "Bruins",
  BUF: "Sabres",
  CAR: "Hurricanes",
  CBJ: "Blue Jackets",
  CGY: "Flames",
  CHI: "Blackhawks",
  COL: "Avalanche",
  DAL: "Stars",
  DET: "Red Wings",
  EDM: "Oilers",
  FLA: "Panthers",
  LAK: "Kings",
  MIN: "Wild",
  MTL: "Canadiens",
  NJD: "Devils",
  NSH: "Predators",
  NYI: "Islanders",
  NYR: "Rangers",
  OTT: "Senators",
  PHI: "Flyers",
  PIT: "Penguins",
  SEA: "Kraken",
  SJS: "Sharks",
  STL: "Blues",
  TBL: "Lightning",
  TOR: "Maple Leafs",
  UTA: "Mammoth",
  VAN: "Canucks",
  VGK: "Golden Knights",
  WPG: "Jets",
  WSH: "Capitals",
};

function normalizeLeague(league) {
  return String(league || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
}

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function shortNameFromFull(fullName) {
  const full = String(fullName || "").trim();
  if (!full) return "";

  for (const city of MLB_TWO_WORD_CITY_PREFIXES) {
    if (full.startsWith(`${city} `)) {
      return full.slice(city.length + 1);
    }
  }

  const parts = full.split(/\s+/);
  if (parts.length <= 1) return full;
  return parts.slice(1).join(" ");
}

export function resolveTeamShortName({ league = "NHL", abbr, fullName = null } = {}) {
  const sport = normalizeLeague(league);
  const key = safeUpper(abbr);
  const fromFull = shortNameFromFull(fullName);
  if (fromFull) return fromFull;

  if (sport === "MLB") {
    return MLB_TEAMS[key] || key || "équipe";
  }

  return NHL_TEAMS[key] || key || "équipe";
}

export function formatWinnerScoreLine({
  winnerAbbr,
  awayAbbr,
  homeAbbr,
  awayScore,
  homeScore,
} = {}) {
  const winner = safeUpper(winnerAbbr);
  const away = safeUpper(awayAbbr);
  const home = safeUpper(homeAbbr);
  const a = Number(awayScore);
  const h = Number(homeScore);

  if (!winner || !Number.isFinite(a) || !Number.isFinite(h)) return "";

  const winnerScore = winner === away ? a : winner === home ? h : null;
  const loserScore = winner === away ? h : winner === home ? a : null;

  if (!Number.isFinite(winnerScore) || !Number.isFinite(loserScore)) return "";
  return `${winnerScore}-${loserScore}`;
}
