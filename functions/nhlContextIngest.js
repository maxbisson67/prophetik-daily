// functions/nhlContextIngest.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

// 🔁 Endpoints
const NHL_STANDINGS = "https://api-web.nhle.com/v1/standings"; // /standings/YYYY-MM-DD ou /standings/now
const NHL_SCHEDULE = "https://api-web.nhle.com/v1/schedule";   // /schedule/YYYY-MM-DD

// ✅ Season dates doc (Option A)
const CURRENT_SEASON_DOC = "app_config/currentSeason";

/* ----------------------------- time helpers ----------------------------- */

function ymdToronto(date = new Date()) {
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

function hmTorontoFromUtcString(utcString) {
  if (!utcString) return null;
  const d = new Date(utcString);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hh = get("hour");
  const mm = get("minute");
  return hh && mm ? `${hh}:${mm}` : null;
}

function addDaysToYmd(ymd, deltaDays) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);

  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");

  return `${yy}-${mm}-${dd}`;
}

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
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

/* ----------------------------- math helpers ----------------------------- */

const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

/* ----------------------------- season dates (Option A) ----------------------------- */

function pickSeasonDates(payload) {
  const pre = payload?.preSeasonStartDate ?? null;
  const rs = payload?.regularSeasonStartDate ?? null;
  const re = payload?.regularSeasonEndDate ?? null;
  const pe = payload?.playoffEndDate ?? null;

  if (!pre && !rs && !re && !pe) return null;

  return {
    sport: "nhl",
    preSeasonStartDate: pre,
    regularSeasonStartDate: rs,
    regularSeasonEndDate: re,
    playoffEndDate: pe,
  };
}

async function writeSeasonDatesIfPresent(schedulePayload) {
  const pre = schedulePayload?.preSeasonStartDate ?? null;
  const rs = schedulePayload?.regularSeasonStartDate ?? null;
  const re = schedulePayload?.regularSeasonEndDate ?? null;
  const pe = schedulePayload?.playoffEndDate ?? null;

  if (!pre && !rs && !re && !pe) return;

  const ref = db.doc(CURRENT_SEASON_DOC);
  const snap = await ref.get();
  const cur = snap.exists ? snap.data() || {} : {};

  // ✅ on évite d’écraser d’autres sports/contexts
  if (String(cur.sport || "nhl").toLowerCase() !== "nhl") return;

  await ref.set(
    {
      sport: "nhl",

      // ✅ tes champs existants, on ne touche pas sauf si tu veux
      // seasonId: cur.seasonId || schedulePayload?.gameWeek?.[0]?.games?.[0]?.season || null,
      // label: cur.label || "...",
      // active: cur.active ?? true,

      // ✅ bornes utilisées dans ton code actuel (getSeasonIdForGameYmd)
      fromYmd: rs || cur.fromYmd || null,
      toYmd: pe || cur.toYmd || null,

      // ✅ détails (optionnels mais top pour debug + règles)
      preSeasonStartYmd: pre,
      regularSeasonStartYmd: rs,
      regularSeasonEndYmd: re,
      playoffEndYmd: pe,

      updatedAt: FieldValue.serverTimestamp(),
      source: "api-web.nhle.com/v1/schedule",
    },
    { merge: true }
  );
}

/* ----------------------------- ingest schedule window ----------------------------- */

async function ingestNhlScheduleWindow({ startYmd, totalDays }) {
  // On avance par "pas de 7 jours" car /schedule/YYYY-MM-DD retourne une semaine
  const visitedWeekKeys = new Set();
  const allGames = [];

  for (let offset = 0; offset <= totalDays; offset += 7) {
    const ymd = addDaysToYmd(startYmd, offset);

    // Fetch week payload
    const payload = await fetchScheduleForYmd(ymd);

    // Clé de semaine (si présent). Sinon fallback sur ymd.
    const weekKey =
      payload?.gameWeek?.[0]?.startDate ||
      payload?.gameWeek?.[0]?.date ||
      ymd;

    if (visitedWeekKeys.has(weekKey)) continue;
    visitedWeekKeys.add(weekKey);

    const games = normalizeSchedule(payload);
    allGames.push(...games);
  }

  // Group by Toronto day and write each day doc
  const groups = groupGamesByTorontoYyyymmdd(allGames);

  let daysWritten = 0;
  for (const [, games] of groups.entries()) {
    await writeDailySchedule({ games });
    daysWritten++;
  }

  logger.info("NHL schedule window done", {
    startYmd,
    totalDays,
    weeksFetched: visitedWeekKeys.size,
    games: allGames.length,
    daysWritten,
  });

  return {
    startYmd,
    totalDays,
    weeksFetched: visitedWeekKeys.size,
    games: allGames.length,
    daysWritten,
  };
}

/* ----------------------------- fetch helpers ----------------------------- */

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
  try {
    return await fetchJson(`${NHL_STANDINGS}/${encodeURIComponent(ymd)}`);
  } catch (e1) {
    logger.warn("Standings date endpoint failed; trying /now", { ymd, msg: e1?.message });
    return await fetchJson(`${NHL_STANDINGS}/now`);
  }
}

async function fetchScheduleForYmd(ymd) {
  try {
    return await fetchJson(`${NHL_SCHEDULE}/${encodeURIComponent(ymd)}`);
  } catch (e1) {
    logger.warn("Schedule date endpoint failed; trying base schedule", { ymd, msg: e1?.message });
    return await fetchJson(`${NHL_SCHEDULE}`);
  }
}

/* ----------------------------- standings normalization ----------------------------- */

function normalizeStandings(payload) {
  const arr = payload?.standings || payload?.data || payload?.records || [];
  const teams = [];

  for (const r of arr) {
    const teamAbbr =
      r?.teamAbbrev?.default ||
      r?.teamAbbrev ||
      r?.teamAbbreviation ||
      r?.team?.abbrev ||
      r?.abbrev;

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

function normalizeSchedule(payload) {
  const weeks = payload?.gameWeek || payload?.weeks || [];
  const games =
    payload?.games ||
    (Array.isArray(weeks) ? weeks.flatMap((w) => w?.games || []) : []);

  const out = [];

  for (const g of games) {
    const id = String(g?.id ?? g?.gameId ?? "");
    const startTimeUTC = g?.startTimeUTC || g?.startTime || g?.gameDate;

    const homeAbbr =
      g?.homeTeam?.abbrev ||
      g?.homeTeam?.teamAbbrev?.default ||
      g?.homeTeam?.teamAbbrev;

    const awayAbbr =
      g?.awayTeam?.abbrev ||
      g?.awayTeam?.teamAbbrev?.default ||
      g?.awayTeam?.teamAbbrev;

    if (!id || !homeAbbr || !awayAbbr) continue;

    const awayScore = toNum(g?.awayTeam?.score, 0);
    const homeScore = toNum(g?.homeTeam?.score, 0);

    const periodNumber = toNum(g?.periodDescriptor?.number, 0);
    const periodType = g?.periodDescriptor?.periodType || null;
    const periodMax = toNum(g?.periodDescriptor?.maxRegulationPeriods, 0);

    const gameState =
      g?.gameState ||
      g?.gameStatus ||
      g?.gameStatusText ||
      null;

    const gameScheduleState = g?.gameScheduleState || null;

    const clock =
      g?.clock?.timeRemaining ||
      g?.timeRemaining ||
      g?.gameClock ||
      null;

    out.push({
      gameId: id,
      startTimeUTC: startTimeUTC || null,

      // existants
      gameType: g?.gameType ?? null,
      season: g?.season ?? null,

      // ✅ nouveaux champs
      awayScore,
      homeScore,
      gameState: gameState || null,
      gameScheduleState,
      period: periodNumber || 0,
      periodType,
      periodMax: periodMax || 0,
      clock: clock || null,
      gameOutcome: g?.gameOutcome || null,

      home: {
        abbr: String(homeAbbr).toUpperCase(),
        id: g?.homeTeam?.id || null,
        name:
          g?.homeTeam?.placeName?.default ||
          g?.homeTeam?.commonName?.default ||
          g?.homeTeam?.name?.default ||
          null,
        logo: g?.homeTeam?.logo || null,
        darkLogo: g?.homeTeam?.darkLogo || null,
      },
      away: {
        abbr: String(awayAbbr).toUpperCase(),
        id: g?.awayTeam?.id || null,
        name:
          g?.awayTeam?.placeName?.default ||
          g?.awayTeam?.commonName?.default ||
          g?.awayTeam?.name?.default ||
          null,
        logo: g?.awayTeam?.logo || null,
        darkLogo: g?.awayTeam?.darkLogo || null,
      },
    });
  }

  return out;
}
/* ----------------------------- league/phase/eligibility ----------------------------- */

function detectLeagueFromLogos(game) {
  const logos = [
    game?.home?.logo,
    game?.home?.darkLogo,
    game?.away?.logo,
    game?.away?.darkLogo,
  ]
    .filter(Boolean)
    .join(" ");

  // NHL logos: .../logos/nhl/...
  if (logos.includes("/logos/nhl/")) return "NHL";
  // Nations / olympiques: .../logos/ntl/...
  if (logos.includes("/logos/ntl/")) return "NTL";

  return "OTHER";
}

function computeNhlPhaseFromGameType(gameType) {
  const t = Number(gameType);
  // NHL: preseason=1, regular=2, playoffs=3 (selon la convention la plus courante)
  if (t === 1) return "preseason";
  if (t === 2) return "regular";
  if (t === 3) return "playoffs";
  return null;
}

// Option A: éligibilité “Prophetik”
function isEligibleForProphetik({ league, nhlPhase }) {
  if (league !== "NHL") return false;
  // ✅ exclure pré-saison
  if (nhlPhase === "preseason") return false;
  // ✅ garder regular + playoffs (ajuste si tu veux exclure playoffs)
  return nhlPhase === "regular" || nhlPhase === "playoffs";
}

/* ----------------------------- coeff context ----------------------------- */

function computeOpponentCoeff({ opponent }) {
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

function computeFatigueCoeff() {
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

/* ----------------------------- firestore writes ----------------------------- */

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

async function writeDailySchedule({ games }) {
  const groups = groupGamesByTorontoYyyymmdd(games);

  for (const [dayYyyymmdd, dayGames] of groups.entries()) {
    const col = db.collection("nhl_schedule_daily").doc(dayYyyymmdd).collection("games");
    let batch = db.batch();
    let ops = 0;

    for (const g of dayGames) {
      const ref = col.doc(String(g.gameId));
      batch.set(ref, { ...g, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    batch.set(
      db.collection("nhl_schedule_daily").doc(dayYyyymmdd),
      { hasGames: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    if (ops) await batch.commit();
  }
}

async function writeDailyMatchups({ games, teamsByAbbr, asOfYmd }) {
  const groups = groupGamesByTorontoYyyymmdd(games);

  for (const [gameYyyymmdd, dayGames] of groups.entries()) {
    const col = db.collection("nhl_matchups_daily").doc(gameYyyymmdd).collection("games");
    let batch = db.batch();
    let ops = 0;

    for (const g of dayGames) {
      const homeTeam = teamsByAbbr[g.home.abbr] || { teamAbbr: g.home.abbr };
      const awayTeam = teamsByAbbr[g.away.abbr] || { teamAbbr: g.away.abbr };
      const context = buildMatchupContext({ homeTeam, awayTeam });

      const startYmdToronto = ymdTorontoFromUtcString(g.startTimeUTC);
      const startYyyymmddToronto = startYmdToronto ? ymdCompact(startYmdToronto) : null;
      const startLocalHmToronto = hmTorontoFromUtcString(g.startTimeUTC);

      // ✅ league + phase + eligibility
        const nhlPhase = computeNhlPhaseFromGameType(g.gameType); // null si inconnu
        const league = nhlPhase ? "NHL" : detectLeagueFromLogos(g); // si gameType connu => NHL
        const eligibleForProphetik =
        nhlPhase === "regular" || nhlPhase === "playoffs"; 

      const ref = col.doc(String(g.gameId));
      batch.set(
        ref,
        {
          gameId: g.gameId,
          startTimeUTC: g.startTimeUTC || null,
          startYmdToronto: startYmdToronto || null,
          startYyyymmddToronto: startYyyymmddToronto || null,
          startLocalHmToronto: startLocalHmToronto || null,

          // ✅ nouveaux champs
          league,
          nhlPhase,
          eligibleForProphetik,
          gameType: g.gameType ?? null,
          season: g.season ?? null,

          home: { ...g.home, ...pickTeamFields(homeTeam) },
          away: { ...g.away, ...pickTeamFields(awayTeam) },
          context,

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

/* ----------------------------- main ingest ----------------------------- */

async function ingestNhlDailyContext(date = new Date()) {
  const ymd = ymdToronto(date);
  const yyyymmdd = ymdCompact(ymd);

  logger.info("NHL daily context ingest start", { ymd, yyyymmdd });

  const [standingsPayload, schedulePayload] = await Promise.all([
    fetchStandingsForYmd(ymd),
    fetchScheduleForYmd(ymd),
  ]);

  // ✅ capture season dates (Option A)
  await writeSeasonDatesIfPresent(schedulePayload);

  const teams = normalizeStandings(standingsPayload);
  const games = normalizeSchedule(schedulePayload);

  const teamsByAbbr = teams.reduce((acc, x) => {
    acc[String(x.teamAbbr).toUpperCase()] = x;
    return acc;
  }, {});

  logger.info("NHL daily context fetched", { teams: teams.length, games: games.length, ymd });

  await writeDailyTeams({ yyyymmdd, teams });
  await writeDailySchedule({ games });
  await writeDailyMatchups({ games, teamsByAbbr, asOfYmd: ymd });

  const daysWritten = groupGamesByTorontoYyyymmdd(games).size;

  logger.info("NHL daily context ingest done", {
    ymd,
    yyyymmdd,
    teams: teams.length,
    games: games.length,
    daysWritten,
  });

  return { ymd, yyyymmdd, teams: teams.length, games: games.length };
}

async function backfillNhlScheduleScores({ startYmd, endYmd }) {
  let cur = startYmd;
  let written = 0;
  const visitedWeekKeys = new Set();

  while (cur <= endYmd) {
    logger.info("NHL schedule backfill processing week", { cur });

    const payload = await fetchScheduleForYmd(cur);

    const weekKey =
      payload?.gameWeek?.[0]?.date ||
      payload?.previousStartDate ||
      cur;

    if (!visitedWeekKeys.has(weekKey)) {
      visitedWeekKeys.add(weekKey);

      const games = normalizeSchedule(payload);
      await writeDailySchedule({ games });
      written++;
    }

    cur = addDaysToYmd(cur, 7);
  }

  logger.info("NHL schedule backfill done", {
    startYmd,
    endYmd,
    weeksProcessed: written,
  });

  return { startYmd, endYmd, weeksProcessed: written };
}

/* ----------------------------- schedules ----------------------------- */

// ⏰ Cron : 8h05 Toronto
export const cronIngestNhlDailyContext = onSchedule(
  {
    schedule: "5 8 * * *",
    //schedule: "*/2 * * * *", // pour test
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => ingestNhlDailyContext(new Date())
);

export const cronRefreshNhlScheduleWindow = onSchedule(
  {
    //schedule: "*/2 * * * *", // pour test
    schedule: "10 3 * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    const today = ymdToronto(new Date());
    const startYmd = addDaysToYmd(today, -7);
    const totalDays = 67; // -7 à +60 = 67 jours
    await ingestNhlScheduleWindow({ startYmd, totalDays });
  }
);

export const cronRefreshNhlScheduleRecentScores = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    const today = ymdToronto(new Date());

    // hier → aujourd’hui → demain
    const startYmd = addDaysToYmd(today, -1);
    const totalDays = 2;

    await ingestNhlScheduleWindow({ startYmd, totalDays });

    logger.info("NHL recent schedule refresh done", {
      startYmd,
      totalDays,
      scope: "yesterday_today_tomorrow",
    });
  }
);
