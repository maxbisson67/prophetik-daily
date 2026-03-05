// functions/utils/espnApi.js
import { logger } from "../utils.js";

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl";

const ESPN_TEAM_MAPPING = {
  "1": "NJD", "2": "NYI", "3": "NYR", "4": "PHI", "5": "PIT",
  "6": "BOS", "7": "BUF", "8": "MTL", "9": "OTT", "10": "TOR",
  "12": "CAR", "13": "FLA", "14": "TBL", "15": "WSH", "16": "CHI",
  "17": "DET", "18": "NSH", "19": "STL", "20": "CGY", "21": "COL",
  "22": "EDM", "23": "VAN", "24": "ANA", "25": "DAL", "26": "LAK",
  "28": "SJS", "29": "CBJ", "30": "MIN", "52": "WPG", "53": "UTA",
  "54": "VGK", "55": "SEA",
};

// Mapping inverse: ESPN team ID -> code
const ESPN_ID_TO_CODE = {
  "25": "ANA", "53": "UTA", "6": "BOS", "7": "BUF", "12": "CAR",
  "29": "CBJ", "20": "CGY", "16": "CHI", "21": "COL", "25": "DAL",
  "17": "DET", "22": "EDM", "13": "FLA", "26": "LAK", "30": "MIN",
  "8": "MTL", "1": "NJD", "18": "NSH", "2": "NYI", "3": "NYR",
  "9": "OTT", "4": "PHI", "5": "PIT", "55": "SEA", "28": "SJS",
  "19": "STL", "14": "TBL", "10": "TOR", "23": "VAN", "54": "VGK",
  "52": "WPG", "15": "WSH",
};

export async function fetchAllNHLInjuriesFromESPN() {
  try {
    const url = `${ESPN_BASE_URL}/injuries`;
    
    logger.info(`[ESPN] Fetching all NHL injuries`);
    
    const response = await fetch(url, {
      headers: { 
        accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; NHLApp/1.0)"
      },
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      logger.error(`[ESPN] HTTP ${response.status}`, {
        status: response.status,
        body: txt?.slice?.(0, 500),
      });
      return [];
    }

    const data = await response.json();
    
    // ✅ La structure correcte: data.injuries (pas data.teams!)
    const teams = Array.isArray(data?.injuries) ? data.injuries : [];
    
    if (teams.length === 0) {
      logger.warn(`[ESPN] No injuries array found in response`);
      return [];
    }
    
    logger.info(`[ESPN] Found teams with injury data`, { count: teams.length });
    
    const allInjuries = [];
    let teamsWithInjuries = 0;
    
    for (const teamData of teams) {
      // teamData contient: { id, displayName, injuries: [...] }
      const teamId = String(teamData.id || "");
      const teamName = teamData.displayName || "";
      const teamAbbrev = ESPN_ID_TO_CODE[teamId] || null;
      
      const injuries = Array.isArray(teamData.injuries) ? teamData.injuries : [];
      
      if (injuries.length === 0) continue;
      
      teamsWithInjuries++;
      
      logger.info(`[ESPN] Processing team`, {
        teamName,
        teamAbbrev,
        injuriesCount: injuries.length
      });
      
      for (const injury of injuries) {
        const athlete = injury.athlete || {};
        
        const fullName = athlete.displayName || athlete.fullName || "";
        const firstName = athlete.firstName || "";
        const lastName = athlete.lastName || "";
        
        allInjuries.push({
          // Info joueur
          playerName: fullName,
          firstName: firstName,
          lastName: lastName,
          espnPlayerId: String(athlete.id || ""),
          
          // Info équipe
          teamAbbrev,
          teamName,
          teamId,
          
          // Info blessure (format compatible avec votre code)
          strStatus: injury.status || "Unknown",
          strInjury: injury.longComment || injury.shortComment || "Undisclosed",
          strPlayer: fullName,
          strTeam: teamName,
          
          // Détails supplémentaires
          description: injury.longComment || injury.shortComment || null,
          dateUpdated: injury.date || null,
          
          // Données brutes pour debug
          rawInjury: injury,
          
          // Source
          source: "espn",
        });
      }
    }
    
    logger.info(`[ESPN] Injuries fetched successfully`, { 
      totalInjuries: allInjuries.length,
      teamsWithInjuries,
      totalTeams: teams.length,
      apiRequestsUsed: 1,
    });
    
    return allInjuries;
  } catch (error) {
    logger.error(`[ESPN] Fetch error`, { 
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}

export function normalizeESPNStatus(espnStatus) {
  const s = String(espnStatus || "").trim().toLowerCase();
  
  if (s.includes("injured reserve") || s.includes("ir")) return "Out";
  if (s.includes("out")) return "Out";
  if (s.includes("day")) return "DayToDay";
  if (s.includes("question")) return "Questionable";
  if (s.includes("doubtful")) return "Doubtful";
  if (s.includes("probable")) return "Probable";
  
  return "Unknown";
}