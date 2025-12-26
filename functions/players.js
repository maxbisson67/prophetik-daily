// functions/players.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, logger, apiWebRoster } from "./utils.js";

async function runRefreshNhlPlayers() {
  const teams = [
    { abbr:"MTL"},{ abbr:"TOR"},{ abbr:"OTT"},{ abbr:"BOS"},{ abbr:"NYR"},{ abbr:"NJD"},
    { abbr:"BUF"},{ abbr:"TBL"},{ abbr:"FLA"},{ abbr:"DET"},{ abbr:"CHI"},{ abbr:"COL"},
    { abbr:"DAL"},{ abbr:"EDM"},{ abbr:"CGY"},{ abbr:"VAN"},{ abbr:"SEA"},{ abbr:"LAK"},
    { abbr:"ANA"},{ abbr:"UTA"},{ abbr:"WPG"},{ abbr:"MIN"},{ abbr:"NSH"},{ abbr:"STL"},
    { abbr:"VGK"},{ abbr:"SJS"},{ abbr:"CBJ"},{ abbr:"PIT"},{ abbr:"PHI"},{ abbr:"WSH"},
    { abbr:"CAR"}
  ];
  for (const team of teams) {
    let roster; try { roster = await apiWebRoster(team); } catch (e) { logger.warn("roster fetch failed", { team:team.abbr, err:String(e) }); continue; }
    const all = [
      ...(roster?.forwards||[]), ...(roster?.defensemen||[]), ...(roster?.goalies||[]),
      ...(Array.isArray(roster?.skaters) ? roster.skaters : []),
    ];
    for (const p of all) {
      const playerId = p?.playerId ?? p?.id;
      const pos = (p?.positionCode ?? p?.position?.abbreviation ?? "").toUpperCase();
      if (!playerId || pos === "G") continue;
      const first = typeof p?.firstName === "string" ? p.firstName : p?.firstName?.default;
      const last  = typeof p?.lastName  === "string" ? p.lastName  : p?.lastName?.default;
      const fullName = [first,last].filter(Boolean).join(" ");
      await db.collection("nhl_players").doc(String(playerId)).set(
        { id:String(playerId), fullName, teamAbbr: String(team.abbr), updatedAt: FieldValue.serverTimestamp() },
        { merge:true }
      );
    }
  }
}

export const refreshNhlPlayers = onCall(async () => { await runRefreshNhlPlayers(); return { ok:true }; });

export const refreshNhlPlayersCron = onSchedule(
  //every 5 minutes
  // 0 3 * * * = à 3 AM tous les jours 
  { schedule: "0 5 * * *", timeZone: "America/Toronto", region: "us-central1" },
  async () => { await runRefreshNhlPlayers(); }
);

// alias historique
export const nightlyNhlPlayers = refreshNhlPlayersCron;