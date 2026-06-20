// functions/utils/espnApi.js
import { logger } from "../utils.js";

const ESPN_NHL_BASE = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl";
const ESPN_MLB_BASE = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb";

const ESPN_NHL_ID_TO_CODE = {
  "25": "ANA", "53": "UTA", "6": "BOS", "7": "BUF", "12": "CAR",
  "29": "CBJ", "20": "CGY", "16": "CHI", "21": "COL", "25": "DAL",
  "17": "DET", "22": "EDM", "13": "FLA", "26": "LAK", "30": "MIN",
  "8": "MTL", "1": "NJD", "18": "NSH", "2": "NYI", "3": "NYR",
  "9": "OTT", "4": "PHI", "5": "PIT", "55": "SEA", "28": "SJS",
  "19": "STL", "14": "TBL", "10": "TOR", "23": "VAN", "54": "VGK",
  "52": "WPG", "15": "WSH",
};

/** ESPN team id → abbr statsapi (mlb_players.teamAbbr) */
const ESPN_MLB_ID_TO_CODE = {
  "1": "BAL",
  "2": "BOS",
  "3": "LAA",
  "4": "CWS",
  "5": "CLE",
  "6": "DET",
  "7": "KC",
  "8": "MIL",
  "9": "MIN",
  "10": "NYY",
  "11": "ATH",
  "12": "SEA",
  "13": "TEX",
  "14": "TOR",
  "15": "ATL",
  "16": "CHC",
  "17": "CIN",
  "18": "HOU",
  "19": "LAD",
  "20": "WSH",
  "21": "NYM",
  "22": "PHI",
  "23": "PIT",
  "24": "STL",
  "25": "SD",
  "26": "SF",
  "27": "COL",
  "28": "MIA",
  "29": "AZ",
  "30": "TB",
};

async function fetchAllInjuriesFromESPN({ baseUrl, teamIdToAbbr, sportLabel }) {
  try {
    const url = `${baseUrl}/injuries`;

    logger.info(`[ESPN] Fetching all ${sportLabel} injuries`);

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; Prophetik/1.0)",
      },
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      logger.error(`[ESPN] HTTP ${response.status}`, {
        sport: sportLabel,
        status: response.status,
        body: txt?.slice?.(0, 500),
      });
      return [];
    }

    const data = await response.json();
    const teams = Array.isArray(data?.injuries) ? data.injuries : [];

    if (teams.length === 0) {
      logger.warn(`[ESPN] No injuries array found in response`, { sport: sportLabel });
      return [];
    }

    logger.info(`[ESPN] Found teams with injury data`, { sport: sportLabel, count: teams.length });

    const allInjuries = [];
    let teamsWithInjuries = 0;

    for (const teamData of teams) {
      const teamId = String(teamData.id || "");
      const teamName = teamData.displayName || "";
      const teamAbbrev = teamIdToAbbr[teamId] || null;
      const injuries = Array.isArray(teamData.injuries) ? teamData.injuries : [];

      if (injuries.length === 0) continue;

      teamsWithInjuries++;

      for (const injury of injuries) {
        const athlete = injury.athlete || {};
        const fullName = athlete.displayName || athlete.fullName || "";
        const firstName = athlete.firstName || "";
        const lastName = athlete.lastName || "";

        allInjuries.push({
          playerName: fullName,
          firstName,
          lastName,
          espnPlayerId: String(athlete.id || ""),
          teamAbbrev,
          teamName,
          teamId,
          strStatus: injury.status || "Unknown",
          strInjury: injury.longComment || injury.shortComment || "Undisclosed",
          strPlayer: fullName,
          strTeam: teamName,
          description: injury.longComment || injury.shortComment || null,
          dateUpdated: injury.date || null,
          rawInjury: injury,
          source: "espn",
        });
      }
    }

    logger.info(`[ESPN] Injuries fetched successfully`, {
      sport: sportLabel,
      totalInjuries: allInjuries.length,
      teamsWithInjuries,
      totalTeams: teams.length,
      apiRequestsUsed: 1,
    });

    return allInjuries;
  } catch (error) {
    logger.error(`[ESPN] Fetch error`, {
      sport: sportLabel,
      error: error.message,
      stack: error.stack,
    });
    return [];
  }
}

export async function fetchAllNHLInjuriesFromESPN() {
  return fetchAllInjuriesFromESPN({
    baseUrl: ESPN_NHL_BASE,
    teamIdToAbbr: ESPN_NHL_ID_TO_CODE,
    sportLabel: "NHL",
  });
}

export async function fetchAllMLBInjuriesFromESPN() {
  return fetchAllInjuriesFromESPN({
    baseUrl: ESPN_MLB_BASE,
    teamIdToAbbr: ESPN_MLB_ID_TO_CODE,
    sportLabel: "MLB",
  });
}

export function normalizeESPNStatus(espnStatus) {
  const s = String(espnStatus || "").trim().toLowerCase();

  if (s.includes("injured reserve") || s.includes("-il") || s.includes(" il")) return "Out";
  if (s.includes("developmental")) return "Out";
  if (s.includes("bereavement")) return "Out";
  if (s.includes("suspension")) return "Out";
  if (s.includes("ir")) return "Out";
  if (s.includes("out")) return "Out";
  if (s.includes("day")) return "DayToDay";
  if (s.includes("question")) return "Questionable";
  if (s.includes("doubtful")) return "Doubtful";
  if (s.includes("probable")) return "Probable";

  return "Unknown";
}
