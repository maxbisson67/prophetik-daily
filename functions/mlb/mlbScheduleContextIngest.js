// functions/mlb/mlbScheduleContextIngest.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const MLB_SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule";
const MLB_SPORT_ID = 1;
const MLB_REGULAR_GAME_TYPE = "R";

/* ----------------------------- helpers ----------------------------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

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

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toStr(v, def = "") {
  return v === null || v === undefined ? def : String(v);
}

function toDateOrNull(v) {
  if (!v) return null;
  const d = v?.toDate?.() ? v.toDate() : v instanceof Date ? v : new Date(v);
  return Number.isFinite(d?.getTime?.()) ? d : null;
}

function normalizeGame(game, forcedYmd = null) {
  const teams = game?.teams || {};
  const away = teams?.away || {};
  const home = teams?.home || {};
  const status = game?.status || {};
  const venue = game?.venue || {};
  const linescore = game?.linescore || {};

  const gamePk = toStr(game?.gamePk, "");
  const gameDate = toStr(game?.gameDate, "");
  const startDate = toDateOrNull(gameDate);

  const ymd = forcedYmd || (gameDate ? gameDate.slice(0, 10) : "");

  const awayTeamId = toNum(away?.team?.id, null);
  const homeTeamId = toNum(home?.team?.id, null);

  return {
    gamePk,
    gameDateYmd: ymd,

    startTimeUTC: startDate || null,
    gameDateRaw: gameDate,

    status: {
      abstractGameState: toStr(status?.abstractGameState, ""),
      abstractGameCode: toStr(status?.abstractGameCode, ""),
      detailedState: toStr(status?.detailedState, ""),
      codedGameState: toStr(status?.codedGameState, ""),
      statusCode: toStr(status?.statusCode, ""),
    },

    awayTeam: {
      id: awayTeamId,
      name: toStr(away?.team?.name, ""),
      abbreviation: toStr(
        away?.team?.abbreviation ||
          away?.team?.teamCode ||
          away?.team?.fileCode ||
          away?.team?.clubName,
        ""
      ),
      logo: awayTeamId
        ? `https://www.mlbstatic.com/team-logos/${awayTeamId}.svg`
        : null,
      score: toNum(away?.score, 0),
      isWinner: away?.isWinner === true,
    },

    homeTeam: {
      id: homeTeamId,
      name: toStr(home?.team?.name, ""),
      abbreviation: toStr(
        home?.team?.abbreviation ||
          home?.team?.teamCode ||
          home?.team?.fileCode ||
          home?.team?.clubName,
        ""
      ),
      logo: homeTeamId
        ? `https://www.mlbstatic.com/team-logos/${homeTeamId}.svg`
        : null,
      score: toNum(home?.score, 0),
      isWinner: home?.isWinner === true,
    },

    venue: {
      id: toNum(venue?.id, null),
      name: toStr(venue?.name, ""),
    },

    inningState: toStr(linescore?.inningState, ""),
    currentInning: toNum(linescore?.currentInning, 0),
    currentInningOrdinal: toStr(linescore?.currentInningOrdinal, ""),

    updatedAt: FieldValue.serverTimestamp(),
    source: "statsapi.mlb.com/api/v1/schedule",
  };
}

/* ----------------------------- fetch ----------------------------- */

function buildScheduleUrl({ startDate, endDate, gameType = MLB_REGULAR_GAME_TYPE }) {
  const url = new URL(MLB_SCHEDULE_URL);

  url.searchParams.set("sportId", String(MLB_SPORT_ID));
  url.searchParams.set("gameType", String(gameType));
  url.searchParams.set("hydrate", "team,linescore,venue");
  url.searchParams.set("startDate", String(startDate));
  url.searchParams.set("endDate", String(endDate));

  logger.info("[mlbScheduleWindow] URL", { url: url.toString() });
  return url;
}

async function fetchScheduleWindow({ startDate, endDate, gameType = MLB_REGULAR_GAME_TYPE }) {
  const url = buildScheduleUrl({ startDate, endDate, gameType });

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("[mlbScheduleWindow] fetch failed", {
      http: res.status,
      url: url.toString(),
      bodySnippet: body?.slice(0, 300),
    });
    throw new Error(`MLB schedule HTTP ${res.status}`);
  }

  return res.json();
}

function extractGames(payload) {
  const dates = Array.isArray(payload?.dates) ? payload.dates : [];
  const out = [];

  for (const dateBlock of dates) {
    const ymd = toStr(dateBlock?.date, "");
    const games = Array.isArray(dateBlock?.games) ? dateBlock.games : [];

    for (const game of games) {
      const row = normalizeGame(game, ymd);
      if (row.gamePk) out.push(row);
    }
  }

  return out;
}

/* ----------------------------- firestore writes ----------------------------- */

async function writeDailyScheduleDocs(games = []) {
  const byDay = new Map();

  for (const g of games) {
    const ymd = toStr(g?.gameDateYmd, "");
    if (!ymd) continue;

    const dayId = ymdCompact(ymd);
    if (!byDay.has(dayId)) byDay.set(dayId, []);
    byDay.get(dayId).push(g);
  }

  let daysWritten = 0;

  for (const [dayId, dayGames] of byDay.entries()) {
    const dayRef = db.collection("mlb_schedule_daily").doc(dayId);

    await dayRef.set(
      {
        ymd: dayGames[0]?.gameDateYmd || null,
        sport: "mlb",
        hasGames: dayGames.length > 0,
        gameCount: dayGames.length,
        updatedAt: FieldValue.serverTimestamp(),
        source: "statsapi.mlb.com/api/v1/schedule",
      },
      { merge: true }
    );

    let batch = db.batch();
    let ops = 0;

    for (const game of dayGames) {
      const ref = dayRef.collection("games").doc(String(game.gamePk));
      batch.set(ref, game, { merge: true });

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

    daysWritten++;
  }

  return daysWritten;
}

/* ----------------------------- ingest ----------------------------- */

async function ingestMlbScheduleWindow({ startYmd, endYmd }) {
  const t0 = Date.now();

  logger.info("[mlbScheduleWindow] ingest start", { startYmd, endYmd });

  const payload = await fetchScheduleWindow({
    startDate: startYmd,
    endDate: endYmd,
    gameType: MLB_REGULAR_GAME_TYPE,
  });

  const games = extractGames(payload);
  const daysWritten = await writeDailyScheduleDocs(games);

  logger.info("[mlbScheduleWindow] ingest done", {
    startYmd,
    endYmd,
    games: games.length,
    daysWritten,
    ms: Date.now() - t0,
  });

  return {
    ok: true,
    startYmd,
    endYmd,
    games: games.length,
    daysWritten,
  };
}

/* ----------------------------- exports ----------------------------- */

export const updateMlbScheduleWindowNow = onCall(
  { region: "us-central1", timeoutSeconds: 540 },
  async (req) => {
    try {
      const today = ymdToronto(new Date());
      const startYmd = String(req.data?.startYmd || addDaysToYmd(today, -7));
      const endYmd = String(req.data?.endYmd || addDaysToYmd(today, 60));

      return await ingestMlbScheduleWindow({ startYmd, endYmd });
    } catch (e) {
      logger.error("[updateMlbScheduleWindowNow]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
      throw new HttpsError("internal", String(e?.message || e));
    }
  }
);

// fenêtre large : -7 à +60
export const refreshMlbScheduleWindow = onSchedule(
  {
    schedule: "10 3 * * *",
    //schedule: "every 15 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    try {
      const today = ymdToronto(new Date());
      const startYmd = addDaysToYmd(today, -7);
      const endYmd = addDaysToYmd(today, 60);

      await ingestMlbScheduleWindow({ startYmd, endYmd });
    } catch (e) {
      logger.error("[refreshMlbScheduleWindow]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
    }
  }
);

// fenêtre courte : hier / aujourd’hui / demain
export const refreshMlbRecentSchedule = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    try {
      const today = ymdToronto(new Date());
      const startYmd = addDaysToYmd(today, -1);
      const endYmd = addDaysToYmd(today, 1);

      await ingestMlbScheduleWindow({ startYmd, endYmd });
    } catch (e) {
      logger.error("[refreshMlbRecentSchedule]", {
        message: String(e?.message || e),
        stack: e?.stack,
      });
    }
  }
);