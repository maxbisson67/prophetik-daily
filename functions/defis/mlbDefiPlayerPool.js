/**
 * Pool TS MLB — inclut opponentProbablePitcher depuis mlb_schedule_daily.
 */
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";
import { getMlbCurrentSeason } from "../players/seasonHelpers.js";
import { buildEmptyMlbPitcher } from "../mlb/mlbProbablePitchers.js";

const POOL_SIZE = 150;
const GETALL_CHUNK = 400;

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function tierFromIndex0(idx0) {
  if (idx0 <= 9) return "T1";
  if (idx0 <= 19) return "T2";
  return "T3";
}

/**
 * Map teamAbbr -> { opponentTeamAbbr, opponentProbablePitcher }
 */
export async function loadMlbOpponentPitchersByTeam(gameDateYmd) {
  const snapId = ymdCompact(gameDateYmd);
  const snap = await db.collection(`mlb_schedule_daily/${snapId}/games`).get();
  const map = new Map();

  snap.forEach((doc) => {
    const g = doc.data() || {};
    const awayAbbr = safeUpper(g?.awayTeam?.abbreviation);
    const homeAbbr = safeUpper(g?.homeTeam?.abbreviation);
    if (!awayAbbr || !homeAbbr) return;

    const awayPitcher = g.awayProbablePitcher || buildEmptyMlbPitcher();
    const homePitcher = g.homeProbablePitcher || buildEmptyMlbPitcher();

    map.set(awayAbbr, {
      opponentTeamAbbr: homeAbbr,
      opponentProbablePitcher: homePitcher,
    });

    map.set(homeAbbr, {
      opponentTeamAbbr: awayAbbr,
      opponentProbablePitcher: awayPitcher,
    });
  });

  return map;
}

async function fetchMlbTeamsPlayingOn(gameDateYmd) {
  const pitchersByTeam = await loadMlbOpponentPitchersByTeam(gameDateYmd);
  return {
    teams: Array.from(pitchersByTeam.keys()),
    pitchersByTeam,
  };
}

export async function buildMlbDefiPlayerPool({
  defiId,
  defiRef,
  gameDateYmd,
}) {
  const seasonId = getMlbCurrentSeason(new Date(`${gameDateYmd}T12:00:00Z`));

  await defiRef.set(
    {
      poolStatus: "building",
      poolSeasonId: seasonId,
      poolGameDate: gameDateYmd,
      sport: "MLB",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const { teams, pitchersByTeam } = await fetchMlbTeamsPlayingOn(gameDateYmd);
  if (!teams.length) throw new Error(`no_mlb_teams_for_date:${gameDateYmd}`);

  const players = [];
  for (const part of chunk(teams, 10)) {
    const snap = await db
      .collection("mlb_players")
      .where("teamAbbr", "in", part)
      .where("active", "==", true)
      .get();
    snap.forEach((doc) => {
      const p = doc.data() || {};
      const pid = String(p.playerId ?? p.id ?? doc.id ?? "");
      if (!pid) return;

      const teamAbbr = safeUpper(p.teamAbbr);
      const opponent = pitchersByTeam.get(teamAbbr) || null;

      players.push({
        playerId: pid,
        fullName: p.fullName || p.name || "",
        teamAbbr,
        positionCode: p.position || p.positionCode || null,
        injury: p.injury || null,
        opponentTeamAbbr: opponent?.opponentTeamAbbr || null,
        opponentProbablePitcher: opponent?.opponentProbablePitcher || buildEmptyMlbPitcher(),
      });
    });
  }

  if (!players.length) throw new Error("no_mlb_players_for_teams");

  const statsMap = new Map();
  const refs = players.map((p) => db.doc(`mlb_player_stats_current/${seasonId}_${p.playerId}`));

  for (const refChunk of chunk(refs, GETALL_CHUNK)) {
    const snaps = await db.getAll(...refChunk);
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data() || {};
      const pid = String(d.playerId ?? "");
      if (!pid) continue;

      const runs = num(d.runs, 0);
      const rbi = num(d.rbi, 0);
      const hits = num(d.hits, 0);
      const homeRuns = num(d.homeRuns, 0);
      const gamesPlayed = num(d.gamesPlayed, 0);
      const points = runs + rbi;

      statsMap.set(pid, {
        runs,
        rbi,
        hits,
        homeRuns,
        gamesPlayed,
        points,
        pointsPerGame: gamesPlayed > 0 ? points / gamesPlayed : 0,
      });
    }
  }

  const merged = players.map((p) => {
    const st = statsMap.get(p.playerId) || {};
    return {
      ...p,
      goals: num(st.runs, 0),
      assists: num(st.rbi, 0),
      points: num(st.points, 0),
      gamesPlayed: num(st.gamesPlayed, 0),
      pointsPerGame: num(st.pointsPerGame, 0),
      coeff: 1,
      reliability: 0,
      scoreNovaBase: num(st.pointsPerGame, 0),
      finalCoeff: 1,
    };
  });

  merged.sort((a, b) => {
    const dp = num(b.points, 0) - num(a.points, 0);
    if (dp) return dp;
    return String(a.fullName || "").localeCompare(String(b.fullName || ""));
  });

  const top = merged.slice(0, POOL_SIZE);
  const batch = db.batch();
  const poolColl = db.collection(`defis/${defiId}/playerPool`);
  const nowTs = FieldValue.serverTimestamp();

  top.forEach((p, idx) => {
    batch.set(poolColl.doc(String(p.playerId)), {
      playerId: String(p.playerId),
      fullName: p.fullName || "",
      teamAbbr: p.teamAbbr || null,
      opponentTeamAbbr: p.opponentTeamAbbr || null,
      opponentProbablePitcher: p.opponentProbablePitcher || buildEmptyMlbPitcher(),
      positionCode: p.positionCode || null,
      injury: p.injury || null,
      goals: num(p.goals, 0),
      assists: num(p.assists, 0),
      points: num(p.points, 0),
      gamesPlayed: num(p.gamesPlayed, 0),
      pointsPerGame: num(p.pointsPerGame, 0),
      coeff: 1,
      reliability: 0,
      finalCoeff: 1,
      scoreNovaBase: num(p.scoreNovaBase, 0),
      seasonId,
      gameDateYmd,
      sport: "MLB",
      rank: idx + 1,
      tier: tierFromIndex0(idx),
      createdAt: nowTs,
    });
  });

  await batch.commit();

  await defiRef.set(
    {
      poolStatus: "ready",
      poolSize: top.length,
      poolSport: "MLB",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("[onDefiCreated] MLB pool ready", {
    defiId,
    gameDateYmd,
    poolSize: top.length,
    teams: teams.length,
  });

  return { ok: true, poolSize: top.length };
}
