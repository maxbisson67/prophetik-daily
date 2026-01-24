// functions/nhlContextIngest.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

// 🔁 Endpoints (à ajuster si la NHL change)
const NHL_STANDINGS = "https://api-web.nhle.com/v1/standings"; // souvent /standings/YYYY-MM-DD ou /standings/now
const NHL_SCHEDULE = "https://api-web.nhle.com/v1/schedule";   // souvent /schedule/YYYY-MM-DD

function ymdToronto(date = new Date()) {
  // simple: on produit YYYY-MM-DD en timezone "America/Toronto" via Intl
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ymdTorontoFromUtcString(utcString) {
  if (!utcString) return null;
  const d = new Date(utcString);
  if (Number.isNaN(d.getTime())) return null;
  return ymdToronto(d);
}

function groupGamesByTorontoYyyymmdd(games = []) {
  const out = new Map();
  for (const g of games) {
    const ymd = ymdTorontoFromUtcString(g?.startTimeUTC);
    if (!ymd) continue;
    const key = ymdCompact(ymd);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(g);
  }
  return out; // Map<yyyymmdd, games[]>
}

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

// ---------- Fetch helpers ----------
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("NHL fetch failed", { url, http: res.status, bodySnippet: body.slice(0, 200) });
    throw new Error(`NHL HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchStandingsForYmd(ymd) {
  // 1) essai avec /standings/YYYY-MM-DD (souvent supporté)
  try {
    return await fetchJson(`${NHL_STANDINGS}/${encodeURIComponent(ymd)}`);
  } catch (e1) {
    // 2) fallback /standings/now
    logger.warn("Standings date endpoint failed; trying /now", { ymd, msg: e1?.message });
    return await fetchJson(`${NHL_STANDINGS}/now`);
  }
}

async function fetchScheduleForYmd(ymd) {
  // 1) essai /schedule/YYYY-MM-DD
  try {
    return await fetchJson(`${NHL_SCHEDULE}/${encodeURIComponent(ymd)}`);
  } catch (e1) {
    logger.warn("Schedule date endpoint failed; trying base schedule", { ymd, msg: e1?.message });
    return await fetchJson(`${NHL_SCHEDULE}`);
  }
}

// ---------- Normalisation standings ----------
function normalizeStandings(payload) {
  // payload varie. On gère quelques formes:
  // - { standings: [...] }
  // - { standings: { ... } } etc.
  const arr =
    payload?.standings ||
    payload?.data ||
    payload?.records ||
    [];

  // On tente de mapper chaque équipe
  const teams = [];

  for (const r of arr) {
    // champs fréquents (peuvent varier)
    const teamAbbr = r?.teamAbbrev?.default || r?.teamAbbrev || r?.teamAbbreviation || r?.team?.abbrev || r?.abbrev;
    const wins = toNum(r?.wins);
    const losses = toNum(r?.losses);
    const otLosses = toNum(r?.otLosses ?? r?.ot ?? r?.overtimeLosses);
    const points = toNum(r?.points);

    const goalsFor = toNum(r?.goalFor ?? r?.goalsFor);
    const goalsAgainst = toNum(r?.goalAgainst ?? r?.goalsAgainst);
    const goalDifferential = toNum(r?.goalDifferential ?? (goalsFor - goalsAgainst));

    const gamesPlayed = toNum(r?.gamesPlayed ?? r?.gp);
    const rankOverall = toNum(r?.leagueSequence ?? r?.leagueRank ?? r?.overallRank ?? r?.rankOverall);

    if (!teamAbbr) continue;

    const gfPerGame = gamesPlayed > 0 ? goalsFor / gamesPlayed : 0;
    const gaPerGame = gamesPlayed > 0 ? goalsAgainst / gamesPlayed : 0;
    const gdPerGame = gamesPlayed > 0 ? goalDifferential / gamesPlayed : 0;

    teams.push({
      teamAbbr: String(teamAbbr).toUpperCase(),
      wins,
      losses,
      otLosses,
      points,
      goalsFor,
      goalsAgainst,
      goalDifferential,
      gamesPlayed,
      gfPerGame: Number(gfPerGame.toFixed(4)),
      gaPerGame: Number(gaPerGame.toFixed(4)),
      gdPerGame: Number(gdPerGame.toFixed(4)),
      rankOverall: rankOverall || 0,
    });
  }

  return teams;
}

// ---------- Normalisation schedule ----------
function normalizeSchedule(payload) {
  // payload varie. On gère une forme courante:
  // { gameWeek: [ { games: [...] } ] } ou { games: [...] }
  const weeks = payload?.gameWeek || payload?.weeks || [];
  const games =
    payload?.games ||
    (Array.isArray(weeks) ? weeks.flatMap((w) => w?.games || []) : []);

  const out = [];

  for (const g of games) {
    const id = String(g?.id ?? g?.gameId ?? "");
    const startTimeUTC = g?.startTimeUTC || g?.startTime || g?.gameDate;

    const homeAbbr = g?.homeTeam?.abbrev || g?.homeTeam?.abbrev?.default || g?.homeTeam?.teamAbbrev?.default || g?.homeTeam?.teamAbbrev;
    const awayAbbr = g?.awayTeam?.abbrev || g?.awayTeam?.abbrev?.default || g?.awayTeam?.teamAbbrev?.default || g?.awayTeam?.teamAbbrev;

    if (!id || !homeAbbr || !awayAbbr) continue;

    out.push({
      gameId: id,
      startTimeUTC: startTimeUTC || null,
      home: { abbr: String(homeAbbr).toUpperCase(), id: g?.homeTeam?.id || null, name: g?.homeTeam?.placeName?.default || g?.homeTeam?.name?.default || null },
      away: { abbr: String(awayAbbr).toUpperCase(), id: g?.awayTeam?.id || null, name: g?.awayTeam?.placeName?.default || g?.awayTeam?.name?.default || null },
    });
  }

  return out;
}

// ---------- Context coeff ----------
function computeOpponentCoeff({ opponent }) {
  // idée: adversaire “faible défensivement” => boost
  // on utilise gaPerGame + gdPerGame (négatif => boost)
  const ga = toNum(opponent?.gaPerGame, 0);
  const gd = toNum(opponent?.gdPerGame, 0);

  // baseline NHL approx ~3.0 GA/GP -> 0
  const gaBoost = clamp((ga - 3.0) / 2.0, -0.08, 0.08); // [-0.08..0.08]
  const gdBoost = clamp((-gd) / 3.0, -0.06, 0.06);      // gd négatif => +boost

  const raw = 1 + gaBoost + gdBoost;
  return clamp(raw, 0.94, 1.06);
}

function computeHomeCoeff(isHome) {
  return isHome ? 1.01 : 0.99;
}

// fatigue: version simple (tu pourras raffiner avec schedule J-1)
function computeFatigueCoeff(/* flags */) {
  return 1.0;
}

function buildMatchupContext({ homeTeam, awayTeam }) {
  const homeOppCoeff = computeOpponentCoeff({ opponent: awayTeam });
  const awayOppCoeff = computeOpponentCoeff({ opponent: homeTeam });

  const homeCoeff = clamp(homeOppCoeff * computeHomeCoeff(true) * computeFatigueCoeff(), 0.92, 1.10);
  const awayCoeff = clamp(awayOppCoeff * computeHomeCoeff(false) * computeFatigueCoeff(), 0.92, 1.10);

  return {
    homeCoeff: Number(homeCoeff.toFixed(4)),
    awayCoeff: Number(awayCoeff.toFixed(4)),
    notes: {
      homeOpp: Number(homeOppCoeff.toFixed(4)),
      awayOpp: Number(awayOppCoeff.toFixed(4)),
    },
  };
}

// ---------- Firestore writes ----------
async function writeDailyTeams({ yyyymmdd, teams }) {
  const col = db.collection("nhl_team_daily").doc(yyyymmdd).collection("teams");
  let batch = db.batch();
  let ops = 0;

  for (const t of teams) {
    const ref = col.doc(String(t.teamAbbr));
    batch.set(ref, { ...t, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops) await batch.commit();
}

async function writeDailySchedule({ yyyymmdd, games }) {
  const col = db.collection("nhl_schedule_daily").doc(yyyymmdd).collection("games");
  let batch = db.batch();
  let ops = 0;

  for (const g of games) {
    const ref = col.doc(String(g.gameId));
    batch.set(ref, { ...g, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops) await batch.commit();
}

async function writeDailyMatchups({ games, teamsByAbbr, asOfYmd }) {
  // Writes to nhl_matchups_daily/{GAME_YYYYMMDD}/games where GAME_YYYYMMDD is the Toronto day of the game
  const groups = groupGamesByTorontoYyyymmdd(games);

  for (const [gameYyyymmdd, dayGames] of groups.entries()) {
    const col = db.collection("nhl_matchups_daily").doc(gameYyyymmdd).collection("games");
    let batch = db.batch();
    let ops = 0;

    for (const g of dayGames) {
      const homeTeam = teamsByAbbr[g.home.abbr] || { teamAbbr: g.home.abbr };
      const awayTeam = teamsByAbbr[g.away.abbr] || { teamAbbr: g.away.abbr };
      const context = buildMatchupContext({ homeTeam, awayTeam });

      const ref = col.doc(String(g.gameId));
      batch.set(
        ref,
        {
          gameId: g.gameId,
          startTimeUTC: g.startTimeUTC || null,
          home: { ...g.home, ...pickTeamFields(homeTeam) },
          away: { ...g.away, ...pickTeamFields(awayTeam) },
          context,
          // indicates when the context was computed
          asOfYmd: asOfYmd || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops) await batch.commit();
  }
}

function pickTeamFields(t) {
  return {
    rankOverall: toNum(t.rankOverall, 0),
    goalDifferential: toNum(t.goalDifferential, 0),
    goalsFor: toNum(t.goalsFor, 0),
    goalsAgainst: toNum(t.goalsAgainst, 0),
    gamesPlayed: toNum(t.gamesPlayed, 0),
    gfPerGame: toNum(t.gfPerGame, 0),
    gaPerGame: toNum(t.gaPerGame, 0),
    gdPerGame: toNum(t.gdPerGame, 0),
    points: toNum(t.points, 0),
    wins: toNum(t.wins, 0),
    losses: toNum(t.losses, 0),
    otLosses: toNum(t.otLosses, 0),
  };
}

// ---------- Main ingest ----------
async function ingestNhlDailyContext(date = new Date()) {
  const ymd = ymdToronto(date);
  const yyyymmdd = ymdCompact(ymd);

  logger.info("NHL daily context ingest start", { ymd, yyyymmdd });

  const [standingsPayload, schedulePayload] = await Promise.all([
    fetchStandingsForYmd(ymd),
    fetchScheduleForYmd(ymd),
  ]);

  const teams = normalizeStandings(standingsPayload);
  const games = normalizeSchedule(schedulePayload);

  const teamsByAbbr = teams.reduce((acc, x) => {
    acc[String(x.teamAbbr).toUpperCase()] = x;
    return acc;
  }, {});

  logger.info("NHL daily context fetched", { teams: teams.length, games: games.length, ymd });

  await writeDailyTeams({ yyyymmdd, teams });
  await writeDailySchedule({ yyyymmdd, games });
  await writeDailyMatchups({ games, teamsByAbbr, asOfYmd: ymd });

  const daysWritten = groupGamesByTorontoYyyymmdd(games).size;

  logger.info("NHL daily context ingest done", { ymd, yyyymmdd, teams: teams.length, games: games.length, daysWritten });
  return { ymd, yyyymmdd, teams: teams.length, games: games.length };
}

// ⏰ Cron : 8h05 Toronto
export const cronIngestNhlDailyContext = onSchedule(
  { 
    schedule: "5 8 * * *", 
    //schedule: "*/2 * * * *", // pour test
    timeZone: "America/Toronto", 
    region: "us-central1" },
  async () => ingestNhlDailyContext(new Date())
);