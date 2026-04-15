// functions/mlb/mlbPlayerStatsIngest.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const MLB_STATS_BASE = "https://statsapi.mlb.com/api/v1/stats";
const PAGE_SIZE = 1000; // MVP: assez grand pour couvrir les batters saisonniers

function getCurrentSeason(date = new Date()) {
  return String(date.getUTCFullYear());
}

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toStr(v, def = "") {
  return v === null || v === undefined ? def : String(v);
}

function buildStatsUrl({
  season,
  group = "hitting",
  stats = "season",
  limit = PAGE_SIZE,
  offset = 0,
}) {
  const url = new URL(MLB_STATS_BASE);

  url.searchParams.set("sportId", "1");          // MLB
  url.searchParams.set("group", group);          // hitting
  url.searchParams.set("stats", stats);          // season
  url.searchParams.set("playerPool", "ALL");
  url.searchParams.set("season", String(season));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  logger.info("[mlbPlayerStats] URL", { url: url.toString() });
  return url;
}

async function fetchStatsPage(season, offset = 0) {
  const url = buildStatsUrl({ season, offset });

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("[mlbPlayerStats] fetch failed", {
      http: res.status,
      url: url.toString(),
      bodySnippet: body?.slice(0, 300),
    });
    throw new Error(`MLB stats HTTP ${res.status}`);
  }

  return res.json();
}

function normalizeSplit(split, seasonId) {
  const stat = split?.stat || {};
  const person = split?.player || split?.person || {};
  const team = split?.team || {};

  const playerId = toStr(person?.id, "");
  const fullName = toStr(person?.fullName || person?.name, "");
  const lastName = fullName ? fullName.split(" ").slice(-1).join(" ") : "";

  const teamAbbr = toStr(
    team?.abbreviation ||
      team?.teamCode ||
      team?.fileCode ||
      team?.shortName,
    ""
  );

  const gamesPlayed = toNum(stat?.gamesPlayed);
  const atBats = toNum(stat?.atBats);
  const plateAppearances = toNum(stat?.plateAppearances);
  const runs = toNum(stat?.runs);
  const hits = toNum(stat?.hits);
  const doubles = toNum(stat?.doubles);
  const triples = toNum(stat?.triples);
  const homeRuns = toNum(stat?.homeRuns);
  const rbi = toNum(stat?.rbi);
  const stolenBases = toNum(stat?.stolenBases);
  const caughtStealing = toNum(stat?.caughtStealing);
  const baseOnBalls = toNum(stat?.baseOnBalls);
  const strikeOuts = toNum(stat?.strikeOuts);
  const hitByPitch = toNum(stat?.hitByPitch);
  const sacFlies = toNum(stat?.sacFlies);
  const sacBunts = toNum(stat?.sacBunts);

  const battingAverage = toStr(stat?.avg || stat?.battingAverage || "0");
  const onBasePercentage = toStr(stat?.obp || "0");
  const sluggingPercentage = toStr(stat?.slg || "0");
  const ops = toStr(stat?.ops || "0");

  return {
    playerId,
    seasonId,

    fullName,
    lastName,
    teamAbbr,

    gamesPlayed,
    atBats,
    plateAppearances,
    runs,
    hits,
    doubles,
    triples,
    homeRuns,
    rbi,
    stolenBases,
    caughtStealing,
    baseOnBalls,
    strikeOuts,
    hitByPitch,
    sacFlies,
    sacBunts,

    battingAverage,
    onBasePercentage,
    sluggingPercentage,
    ops,
  };
}

async function fetchAllBattersForSeason(seasonId) {
  const all = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchStatsPage(seasonId, offset);

    const stats = Array.isArray(page?.stats) ? page.stats : [];
    const firstStatsBlock = stats[0] || {};
    const splits = Array.isArray(firstStatsBlock?.splits) ? firstStatsBlock.splits : [];

    logger.info("[mlbPlayerStats] page", {
      seasonId,
      offset,
      count: splits.length,
    });

    if (!splits.length) break;

    all.push(...splits);

    if (splits.length < PAGE_SIZE) break;
  }

  const rows = all
    .map((split) => normalizeSplit(split, seasonId))
    .filter((r) => r.playerId && r.fullName);

  const dedup = Object.values(
    rows.reduce((acc, row) => {
      acc[row.playerId] = row;
      return acc;
    }, {})
  );

  return dedup;
}

async function upsertStatsToFirestore(rows, seasonId) {
  let written = 0;
  let batch = db.batch();
  let ops = 0;

  for (const r of rows) {
    if (!r.playerId) continue;

    const docId = `${seasonId}_${r.playerId}`;
    const ref = db.collection("mlb_player_stats_current").doc(docId);

    batch.set(
      ref,
      {
        ...r,
        seasonId,
        updatedAt: FieldValue.serverTimestamp(),
        source: "statsapi.mlb.com/api/v1/stats?group=hitting&stats=season",
      },
      { merge: true }
    );

    written++;
    ops++;

    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  return written;
}

async function ingestSeason(seasonId) {
  const t0 = Date.now();

  logger.info("[mlbPlayerStats] ingest start", { seasonId });

  const rows = await fetchAllBattersForSeason(seasonId);

  logger.info("[mlbPlayerStats] fetched", {
    seasonId,
    count: rows.length,
  });

  const written = await upsertStatsToFirestore(rows, seasonId);

  logger.info("[mlbPlayerStats] ingest done", {
    seasonId,
    written,
    ms: Date.now() - t0,
  });

  return { ok: true, seasonId, written };
}

/* ===================== EXPORTED FUNCTIONS ===================== */

export const ingestMlbPlayerStatsForSeason = onCall(
  { region: "us-central1", timeoutSeconds: 540 },
  async (req) => {
    try {
      const seasonId = String(req.data?.seasonId || getCurrentSeason());
      return await ingestSeason(seasonId);
    } catch (e) {
      logger.error("[ingestMlbPlayerStatsForSeason]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);

export const cronIngestMlbPlayerStatsDaily = onSchedule(
  {
    schedule: "0 8 * * *",
    //schedule: "*/2 * * * *", // test chaque 2 minutes
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    try {
      return;  // arrêter l'exécution pour le moment
      const seasonId = getCurrentSeason();
      logger.info("[cronIngestMlbPlayerStatsDaily] running", { seasonId });
      return await ingestSeason(seasonId);
    } catch (e) {
      logger.error("[cronIngestMlbPlayerStatsDaily]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
    }
  }
);