// functions/autopilot/createDailyFgcAutopilot.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue, logger, apiWebSchedule } from "../utils.js";
import { APP_TZ, appYmd, addDays } from "../ProphetikDate.js";
import { FUNCTIONS_REGION } from "../regions.js";
import { createTpBundleForGroupIfNeeded } from "./createTpBundleForGroup.js";
import { notifyGroupOfAutopilotChallenges } from "./autopilotNotification.js";

const MLB_SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule";

/* ----------------------------- helpers ----------------------------- */

function ymdInToronto(date = new Date()) {
  return appYmd(date);
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeTeamAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function getGroupSport(group) {
  const sport = String(group?.sport || group?.favoriteTeam?.sport || "").toUpperCase();
  return ["MLB", "NHL"].includes(sport) ? sport : null;
}

function isActiveGroup(group) {
  if (group?.active === false) return false;
  if (group?.status && String(group.status) !== "active") return false;
  return true;
}

function toDateSafe(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeNhlAbbr(g, side) {
  const team = g?.[`${side}Team`] || g?.[side] || {};
  const abbr =
    team?.abbrev ||
    team?.teamAbbrev?.default ||
    team?.teamAbbrev ||
    team?.abbr;
  return normalizeTeamAbbr(abbr);
}

function normalizeNhlTeamId(g, side) {
  const team = g?.[`${side}Team`] || g?.[side] || {};
  const id = team?.id ?? team?.teamId ?? null;
  return id == null ? "" : String(id);
}

/* ----------------------------- schedules ----------------------------- */

async function fetchMlbScheduleForYmd(gameYmd) {
  const url = `${MLB_SCHEDULE_URL}?sportId=1&date=${encodeURIComponent(gameYmd)}&hydrate=team,probablePitcher`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });
  if (!res.ok) throw new Error(`MLB schedule failed ${res.status}`);

  const json = await res.json();
  const dates = Array.isArray(json?.dates) ? json.dates : [];
  const rawGames = dates.flatMap((d) => d?.games || []);

  const out = [];

  for (const game of rawGames) {
    const gamePk = String(game?.gamePk || "").trim();
    const gameDate = String(game?.gameDate || "").trim();
    const start = toDateSafe(gameDate);
    const homeAbbr = normalizeTeamAbbr(
      game?.teams?.home?.team?.abbreviation ||
        game?.teams?.home?.team?.teamCode ||
        game?.teams?.home?.team?.fileCode
    );
    const awayAbbr = normalizeTeamAbbr(
      game?.teams?.away?.team?.abbreviation ||
        game?.teams?.away?.team?.teamCode ||
        game?.teams?.away?.team?.fileCode
    );
    const homeTeamId = game?.teams?.home?.team?.id != null ? String(game.teams.home.team.id) : "";
    const awayTeamId = game?.teams?.away?.team?.id != null ? String(game.teams.away.team.id) : "";

    const abstractState = String(game?.status?.abstractGameState || "");
    if (["Cancelled", "Postponed"].includes(abstractState)) continue;

    const gameType = String(game?.gameType || "");
    if (gameType && gameType !== "R") continue;

    if (!gamePk || !start || !homeAbbr || !awayAbbr || homeAbbr.length < 2 || awayAbbr.length < 2) {
      continue;
    }

    out.push({
      league: "MLB",
      gameId: gamePk,
      gamePk,
      gameStartTimeUTC: start,
      gameYmd,
      homeAbbr,
      awayAbbr,
      homeTeamId,
      awayTeamId,
    });
  }

  return out;
}

async function fetchNhlScheduleForYmd(gameYmd) {
  const sched = await apiWebSchedule(gameYmd);

  const day = Array.isArray(sched?.gameWeek)
    ? sched.gameWeek.find((d) => d?.date === gameYmd)
    : null;

  const rawGames = day?.games || (Array.isArray(sched?.games) ? sched.games : []);

  const out = [];

  for (const g of rawGames) {
    const gameId = String(g?.id ?? g?.gameId ?? "").trim();
    const homeAbbr = normalizeNhlAbbr(g, "home");
    const awayAbbr = normalizeNhlAbbr(g, "away");
    const homeTeamId = normalizeNhlTeamId(g, "home");
    const awayTeamId = normalizeNhlTeamId(g, "away");
    const start = toDateSafe(g?.startTimeUTC || g?.startTime || g?.gameDate);

    const gameState = String(g?.gameState || g?.gameStatus || "").toUpperCase();
    if (["CANCELLED", "POSTPONED"].includes(gameState)) continue;

    if (!gameId || !start || !homeAbbr || !awayAbbr || homeAbbr.length < 2 || awayAbbr.length < 2) {
      continue;
    }

    out.push({
      league: "NHL",
      gameId,
      gameStartTimeUTC: start,
      gameYmd,
      homeAbbr,
      awayAbbr,
      homeTeamId,
      awayTeamId,
    });
  }

  return out;
}

/* ----------------------------- selection / idempotence ----------------------------- */

function selectGameForGroup({ games, group, sport }) {
  if (!Array.isArray(games) || !games.length) return null;

  const fav = group?.favoriteTeam || null;

  if (fav && String(fav.sport || "").toUpperCase() === sport) {
    const favAbbr = normalizeTeamAbbr(fav.abbreviation);
    const favTeamId = String(fav.teamId || "");

    const favoriteGame = games.find(
      (g) =>
        normalizeTeamAbbr(g.homeAbbr) === favAbbr ||
        normalizeTeamAbbr(g.awayAbbr) === favAbbr ||
        String(g.homeTeamId || "") === favTeamId ||
        String(g.awayTeamId || "") === favTeamId
    );

    if (favoriteGame) return favoriteGame;
  }

  return pickRandom(games);
}

async function hasExistingFgcForGroupDay({ groupId, sport, gameYmd }) {
  const snap = await db
    .collection("first_goal_challenges")
    .where("groupId", "==", String(groupId))
    .where("league", "==", sport)
    .where("type", "==", "first_goal")
    .where("gameYmd", "==", gameYmd)
    .limit(1)
    .get();

  return !snap.empty;
}

/* ----------------------------- create ----------------------------- */

async function createMlbFgcChallenge({ groupId, selected, gameYmd }) {
  const ref = await db.collection("first_goal_challenges").add({
    league: "MLB",
    type: "first_goal",
    fgcMode: "first_rbi",

    groupId: String(groupId),
    createdBy: "system",
    autopilotCreated: true,
    autopilotCreatedAt: FieldValue.serverTimestamp(),

    gameId: selected.gameId,
    gamePk: selected.gamePk,
    gameYmd,

    homeAbbr: selected.homeAbbr,
    awayAbbr: selected.awayAbbr,
    gameStartTimeUTC: Timestamp.fromDate(selected.gameStartTimeUTC),

    status: "open",
    participantsCount: 0,
    winnersCount: 0,
    winnersPreviewUids: [],

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(addDays(new Date(), 2)),
  });

  return ref.id;
}

async function createNhlFgcChallenge({ groupId, selected, gameYmd }) {
  const ref = await db.collection("first_goal_challenges").add({
    league: "NHL",
    type: "first_goal",
    fgcMode: "first_goal",

    groupId: String(groupId),
    createdBy: "system",
    autopilotCreated: true,
    autopilotCreatedAt: FieldValue.serverTimestamp(),

    gameId: selected.gameId,
    gameYmd,

    homeAbbr: selected.homeAbbr,
    awayAbbr: selected.awayAbbr,
    gameStartTimeUTC: Timestamp.fromDate(selected.gameStartTimeUTC),

    status: "open",
    participantsCount: 0,
    winnersCount: 0,
    winnersPreviewUids: [],

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(addDays(new Date(), 2)),
  });

  return ref.id;
}

async function createFgcChallengeForGroup({ groupId, sport, selected, gameYmd }) {
  if (sport === "MLB") {
    return createMlbFgcChallenge({ groupId, selected, gameYmd });
  }
  if (sport === "NHL") {
    return createNhlFgcChallenge({ groupId, selected, gameYmd });
  }
  return null;
}

/* ----------------------------- scheduler ----------------------------- */

export const createDailyFgcAutopilot = onSchedule(
  {
    schedule: "30 6 * * *",
    timeZone: "America/Toronto",
    region: FUNCTIONS_REGION,
  },
  async () => {
    const gameYmd = ymdInToronto(new Date());

    logger.info("[GROUP AUTOPILOT] start", { gameYmd, tz: APP_TZ });

    const groupsSnap = await db
      .collection("groups")
      .where("autopilotEnabled", "==", true)
      .limit(500)
      .get();

    if (groupsSnap.empty) {
      logger.info("[GROUP AUTOPILOT] groups found", { count: 0 });
      return;
    }

    logger.info("[GROUP AUTOPILOT] groups found", { count: groupsSnap.size });

    const scheduleCache = {
      MLB: null,
      NHL: null,
    };
    const tpEligibleGamesCache = {};

    let groupsNotified = 0;
    let challengesCreated = 0;

    for (const groupDoc of groupsSnap.docs) {
      const groupId = groupDoc.id;
      const group = groupDoc.data() || {};

      if (!isActiveGroup(group)) continue;

      const sport = getGroupSport(group);
      if (!sport) {
        logger.info("[GROUP AUTOPILOT] skipped invalid sport", { groupId });
        continue;
      }

      const createdChallenges = [];

      try {
        const fgcExists = await hasExistingFgcForGroupDay({ groupId, sport, gameYmd });
        if (!fgcExists) {
          if (scheduleCache[sport] == null) {
            scheduleCache[sport] =
              sport === "MLB"
                ? await fetchMlbScheduleForYmd(gameYmd)
                : await fetchNhlScheduleForYmd(gameYmd);

            logger.info("[GROUP AUTOPILOT] fgc games loaded", {
              sport,
              count: scheduleCache[sport].length,
              gameYmd,
            });
          }

          const games = scheduleCache[sport] || [];
          const selected = games.length ? selectGameForGroup({ games, group, sport }) : null;

          if (selected) {
            const challengeId = await createFgcChallengeForGroup({
              groupId,
              sport,
              selected,
              gameYmd,
            });

            if (challengeId) {
              createdChallenges.push({
                type: "fgc",
                challengeId,
                awayAbbr: selected.awayAbbr,
                homeAbbr: selected.homeAbbr,
              });

              logger.info("[GROUP AUTOPILOT] fgc created", {
                groupId,
                sport,
                challengeId,
                gameId: selected.gameId,
              });
            }
          } else {
            logger.info("[GROUP AUTOPILOT] fgc skipped no games", { groupId, sport });
          }
        } else {
          logger.info("[GROUP AUTOPILOT] fgc skipped existing", { groupId, sport });
        }

        const tpResult = await createTpBundleForGroupIfNeeded({
          db,
          groupId,
          group,
          league: sport,
          eligibleGamesCache: tpEligibleGamesCache,
        });

        if (tpResult.created) {
          createdChallenges.push({
            type: "tp",
            bundleId: tpResult.bundleId,
            gameCount: tpResult.gameCount,
          });

          logger.info("[GROUP AUTOPILOT] tp created", {
            groupId,
            sport,
            bundleId: tpResult.bundleId,
            gameCount: tpResult.gameCount,
            gameIds: tpResult.gameIds,
          });
        } else if (tpResult.reason === "exists") {
          logger.info("[GROUP AUTOPILOT] tp skipped existing", { groupId, sport });
        } else if (tpResult.reason === "no-games") {
          logger.info("[GROUP AUTOPILOT] tp skipped no games", { groupId, sport });
        }

        if (createdChallenges.length) {
          await notifyGroupOfAutopilotChallenges({
            groupId,
            sport,
            createdChallenges,
            gameYmd,
          });
          groupsNotified += 1;
          challengesCreated += createdChallenges.length;
        }
      } catch (e) {
        logger.warn("[GROUP AUTOPILOT] group failed", {
          groupId,
          sport,
          err: String(e?.message || e),
        });
      }
    }

    logger.info("[GROUP AUTOPILOT] done", { gameYmd, groupsNotified, challengesCreated });
  }
);

export {
  ymdInToronto,
  pickRandom,
  normalizeTeamAbbr,
  getGroupSport,
  fetchMlbScheduleForYmd,
  fetchNhlScheduleForYmd,
  selectGameForGroup,
  hasExistingFgcForGroupDay,
  createMlbFgcChallenge,
  createNhlFgcChallenge,
};
