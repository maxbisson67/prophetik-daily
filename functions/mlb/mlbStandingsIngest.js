// functions/mlb/mlbStandingsIngest.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const MLB_STANDINGS_URL = "https://statsapi.mlb.com/api/v1/standings";
const MLB_SPORT_ID = 1;
const MLB_LEAGUE_IDS = [103, 104]; // AL, NL

function getCurrentSeason(date = new Date()) {
  return String(date.getUTCFullYear());
}

function getPreviousSeason(date = new Date()) {
  return String(Number(getCurrentSeason(date)) - 1);
}

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toStr(v, def = "") {
  return v === null || v === undefined ? def : String(v);
}

function buildStandingsUrl({
  season = getCurrentSeason(),
  standingsTypes = "regularSeason",
  date = null,
} = {}) {
  const url = new URL(MLB_STANDINGS_URL);

  url.searchParams.set("sportId", String(MLB_SPORT_ID));
  url.searchParams.set("leagueId", MLB_LEAGUE_IDS.join(","));
  url.searchParams.set("season", String(season));
  url.searchParams.set("standingsTypes", String(standingsTypes));

  if (date) {
    url.searchParams.set("date", String(date));
  }

  logger.info("[mlbStandings] URL", { url: url.toString() });
  return url;
}

async function fetchStandings({
  season = getCurrentSeason(),
  standingsTypes = "regularSeason",
  date = null,
} = {}) {
  const url = buildStandingsUrl({ season, standingsTypes, date });

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("[mlbStandings] fetch failed", {
      http: res.status,
      url: url.toString(),
      bodySnippet: body?.slice(0, 300),
    });
    throw new Error(`MLB standings HTTP ${res.status}`);
  }

  return res.json();
}

function mlbDivisionLabel(division = {}) {
  const id = toNum(division?.id, null);

  const direct =
    toStr(division?.name, "") ||
    toStr(division?.nameShort, "") ||
    toStr(division?.abbreviation, "");

  if (direct) return direct;

  const MAP = {
    200: "AL West",
    201: "AL East",
    202: "AL Central",
    203: "NL West",
    204: "NL East",
    205: "NL Central",
  };

  return MAP[id] || "";
}

function normalizeTeamRecord(teamRecord) {
  const team = teamRecord?.team || {};
  const leagueRecord = teamRecord?.leagueRecord || {};
  const records = teamRecord?.records || {};
  const splitRecords = Array.isArray(records?.splitRecords) ? records.splitRecords : [];

  const homeRec =
    splitRecords.find((r) => String(r?.type || "").toLowerCase() === "home") || {};
  const awayRec =
    splitRecords.find((r) => String(r?.type || "").toLowerCase() === "away") || {};
  const lastTenRec =
    splitRecords.find((r) => String(r?.type || "").toLowerCase() === "lastten") || {};

  const teamId = toNum(team?.id, null);

  return {
    team: {
      id: teamId,
      name: toStr(team?.name, ""),
      abbreviation: toStr(
        team?.abbreviation ||
          team?.teamCode ||
          team?.fileCode ||
          team?.clubName,
        ""
      ),
      link: toStr(team?.link, ""),
      logo: teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : null,
    },

    gamesPlayed: toNum(teamRecord?.gamesPlayed, 0),
    wins: toNum(teamRecord?.wins, 0),
    losses: toNum(teamRecord?.losses, 0),
    winningPercentage: toStr(teamRecord?.winningPercentage, "0"),
    runsScored: toNum(teamRecord?.runsScored, 0),
    runsAllowed: toNum(teamRecord?.runsAllowed, 0),
    runDifferential: toNum(teamRecord?.runDifferential, 0),

    sportRank: toStr(teamRecord?.sportRank, ""),
    leagueRank: toStr(teamRecord?.leagueRank, ""),
    divisionRank: toStr(teamRecord?.divisionRank, ""),
    conferenceRank: toStr(teamRecord?.conferenceRank, ""),
    wildCardRank: toStr(teamRecord?.wildCardRank, ""),
    wildCardGamesBack: toStr(teamRecord?.wildCardGamesBack, ""),
    divisionGamesBack: toStr(teamRecord?.divisionGamesBack, ""),
    leagueGamesBack: toStr(teamRecord?.leagueGamesBack, ""),
    sportGamesBack: toStr(teamRecord?.sportGamesBack, ""),

    streak: {
      streakType: toStr(teamRecord?.streak?.streakType, ""),
      streakNumber: toNum(teamRecord?.streak?.streakNumber, 0),
      streakCode: toStr(teamRecord?.streak?.streakCode, ""),
    },

    leagueRecord: {
      wins: toNum(leagueRecord?.wins, 0),
      losses: toNum(leagueRecord?.losses, 0),
      pct: toStr(leagueRecord?.pct, "0"),
    },

    home: {
      wins: toNum(homeRec?.wins, 0),
      losses: toNum(homeRec?.losses, 0),
      pct: toStr(homeRec?.pct, "0"),
    },

    away: {
      wins: toNum(awayRec?.wins, 0),
      losses: toNum(awayRec?.losses, 0),
      pct: toStr(awayRec?.pct, "0"),
    },

    lastTen: {
      wins: toNum(lastTenRec?.wins, 0),
      losses: toNum(lastTenRec?.losses, 0),
      pct: toStr(lastTenRec?.pct, "0"),
    },
  };
}

function buildWildcardRows(divisions = []) {
  const allTeams = divisions.flatMap((d) =>
    Array.isArray(d?.teamRecords) ? d.teamRecords : []
  );

  return allTeams
    .filter((t) => {
      const rank = toStr(t?.wildCardRank, "");
      return rank && rank !== "-" && rank !== "0";
    })
    .sort((a, b) => {
      const ra = toNum(a?.wildCardRank, 999);
      const rb = toNum(b?.wildCardRank, 999);
      if (ra !== rb) return ra - rb;

      const wa = toNum(a?.wins, 0);
      const wb = toNum(b?.wins, 0);
      return wb - wa;
    });
}

function normalizeStandingsByLeague(raw, { season, standingsTypes, date }) {
  const records = Array.isArray(raw?.records) ? raw.records : [];
  const byLeague = {};

  for (const rec of records) {
    const league = rec?.league || {};
    const division = rec?.division || {};
    const conference = rec?.conference || {};
    const teamRecords = Array.isArray(rec?.teamRecords) ? rec.teamRecords : [];

    const leagueId = String(toNum(league?.id, ""));
    if (!leagueId) continue;

    if (!byLeague[leagueId]) {
      byLeague[leagueId] = {
        league: {
          id: toNum(league?.id, null),
          name: toStr(league?.name, ""),
          link: toStr(league?.link, ""),
        },
        season: String(season),
        standingsTypes: String(standingsTypes),
        date: date || null,
        divisions: [],
        wildcard: [],
      };
    }

    byLeague[leagueId].divisions.push({
      key: `${season}_${standingsTypes}_${division?.id || leagueId}`,
      division: {
        id: toNum(division?.id, null),
        name: mlbDivisionLabel(division),
        nameShort: toStr(division?.nameShort, ""),
        abbreviation: toStr(division?.abbreviation, ""),
        link: toStr(division?.link, ""),
      },
      conference: {
        id: toNum(conference?.id, null),
        name: toStr(conference?.name, ""),
        link: toStr(conference?.link, ""),
      },
      sport: {
        id: toNum(rec?.sport?.id, MLB_SPORT_ID),
        link: toStr(rec?.sport?.link, ""),
      },
      teamRecords: teamRecords.map(normalizeTeamRecord),
    });
  }

  for (const leagueId of Object.keys(byLeague)) {
    byLeague[leagueId].wildcard = buildWildcardRows(byLeague[leagueId].divisions);
  }

  return byLeague;
}

async function writeStandings(raw, { season, standingsTypes, date }) {
  const byLeague = normalizeStandingsByLeague(raw, { season, standingsTypes, date });

  await db.doc(`mlb_standings/${season}`).set(
    {
      sport: "mlb",
      season: String(season),
      standingsTypes: String(standingsTypes),
      date: date || null,
      leagueIds: Object.keys(byLeague),
      updatedAt: FieldValue.serverTimestamp(),
      source: "statsapi.mlb.com/api/v1/standings",
    },
    { merge: true }
  );

  let count = 0;

  for (const [leagueId, leagueData] of Object.entries(byLeague)) {
    await db.doc(`mlb_standings/${season}/leagues/${leagueId}`).set(
      {
        ...leagueData,
        updatedAt: FieldValue.serverTimestamp(),
        source: "statsapi.mlb.com/api/v1/standings",
      },
      { merge: true }
    );

    count += leagueData.divisions.length;
  }

  if (String(season) === getCurrentSeason()) {
    await db.doc("mlb_standings/current").set(
      {
        sport: "mlb",
        season: String(season),
        standingsTypes: String(standingsTypes),
        date: date || null,
        leagueIds: Object.keys(byLeague),
        updatedAt: FieldValue.serverTimestamp(),
        source: "statsapi.mlb.com/api/v1/standings",
      },
      { merge: true }
    );
  }

  return count;
}

async function ingestStandings({
  season = getCurrentSeason(),
  standingsTypes = "regularSeason",
  date = null,
} = {}) {
  const t0 = Date.now();

  logger.info("[mlbStandings] ingest start", {
    season,
    standingsTypes,
    date,
  });

  const raw = await fetchStandings({ season, standingsTypes, date });
  const count = await writeStandings(raw, { season, standingsTypes, date });

  logger.info("[mlbStandings] ingest done", {
    season,
    standingsTypes,
    date,
    count,
    ms: Date.now() - t0,
  });

  return {
    ok: true,
    season: String(season),
    standingsTypes: String(standingsTypes),
    date: date || null,
    count,
  };
}

/* =========================
   Callable (manual refresh)
========================= */
export const updateMlbStandingsNow = onCall(
  { region: "us-central1", timeoutSeconds: 540 },
  async (req) => {
    try {
      const season = String(req.data?.season || getCurrentSeason());
      const standingsTypes = String(req.data?.standingsTypes || "regularSeason");
      const date = req.data?.date ? String(req.data.date) : null;

      return await ingestStandings({ season, standingsTypes, date });
    } catch (e) {
      logger.error("[updateMlbStandingsNow]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);

/* =========================
   Scheduled refresh - current season only
========================= */
export const refreshMlbStandings = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    try {
      const currentSeason = getCurrentSeason();

      const currentRes = await ingestStandings({
        season: currentSeason,
        standingsTypes: "regularSeason",
      });

      logger.info("[refreshMlbStandings] updated current season", {
        current: currentRes,
      });
    } catch (e) {
      logger.error("[refreshMlbStandings]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
    }
  }
);

/* =========================
   Scheduled refresh - previous season daily
========================= */
export const refreshMlbPreviousSeasonStandingsDaily = onSchedule(
  {
    schedule: "15 4 * * *",
    //schedule: "every 2 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    try {
      return;  // arrêter l'exécution pour le moment
      const previousSeason = getPreviousSeason();

      const res = await ingestStandings({
        season: previousSeason,
        standingsTypes: "regularSeason",
      });

      logger.info("[refreshMlbPreviousSeasonStandingsDaily] updated", res);
    } catch (e) {
      logger.error("[refreshMlbPreviousSeasonStandingsDaily]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
    }
  }
);