// functions/nhlLive.js
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, FieldValue, logger, apiWebSchedule, apiWebPbp } from "./utils.js";
import { todayAppYmd, addDaysToYmd } from "./ProphetikDate.js";

const NHL_HEADSHOT_SEASON = "20242025";

// ---------- Helpers ----------
function normTeamAbbr(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw.toUpperCase();
  return String(raw.abbrev || raw.default || "").toUpperCase() || null;
}

function normalizePlayerId(id) {
  if (id === null || id === undefined) return null;
  return String(id);
}

function createPlayerResolver() {
  const cache = new Map();

  return async function resolvePlayer(playerIdRaw, fallbackName = null) {
    const playerId = normalizePlayerId(playerIdRaw);
    if (!playerId) return { id: null, name: fallbackName || null, teamAbbr: null };

    if (cache.has(playerId)) {
      const cached = cache.get(playerId);
      return {
        id: playerId,
        name: cached.name || fallbackName || null,
        teamAbbr: cached.teamAbbr || null,
      };
    }

    let name = fallbackName || null;
    let teamAbbr = null;

    try {
      const snap = await db.collection("nhl_players").doc(playerId).get();
      if (snap.exists) {
        const d = snap.data() || {};
        name = d.fullName || d.name || d.full_name || d.displayName || fallbackName || null;
        teamAbbr = d.teamAbbr || d.currentTeamAbbr || d.team || null;
        if (typeof teamAbbr === "string") teamAbbr = teamAbbr.toUpperCase();
      }
    } catch (err) {
      logger.warn("[resolvePlayer] Firestore error", { playerId, error: err?.message || String(err) });
    }

    const value = { name, teamAbbr };
    cache.set(playerId, value);
    return { id: playerId, ...value };
  };
}

function torontoCurrentHour() {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      hour12: false,
      hour: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const hStr = parts.find((p) => p.type === "hour")?.value;
    const hNum = hStr ? parseInt(hStr, 10) : now.getUTCHours();
    return Number.isNaN(hNum) ? 0 : hNum;
  } catch {
    return 0;
  }
}

function formatSecondsToMmSs(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.floor(seconds));
  const mPart = Math.floor(s / 60);
  const sPart = s % 60;
  return `${String(mPart).padStart(2, "0")}:${String(sPart).padStart(2, "0")}`;
}

// PBP can vary; support multiple shapes
function extractPlays(pbp) {
  if (!pbp) return [];
  if (Array.isArray(pbp.plays)) return pbp.plays;
  if (Array.isArray(pbp.allPlays)) return pbp.allPlays;
  if (Array.isArray(pbp?.playsByPeriod)) {
    const out = [];
    for (const blk of pbp.playsByPeriod) {
      if (Array.isArray(blk?.plays)) out.push(...blk.plays);
    }
    return out;
  }
  return [];
}

function isGoalPlay(play) {
  const typeKey = String(play?.typeDescKey || play?.type || play?.eventType || "").toLowerCase();
  const typeCode = Number(play?.typeCode || play?.eventTypeId || 0);
  // NHL “goal” est souvent typeDescKey=goal ou typeCode=505
  return typeKey === "goal" || typeCode === 505;
}

// ---------- Main ----------
async function runUpdateNhlLiveGames(forYmd) {
  const ymd =
    typeof forYmd === "string" && forYmd.length >= 10 ? forYmd.slice(0, 10) : todayAppYmd();

  logger.info("[updateNhlLiveGames] tick", { ymd, forYmd });

  const resolvePlayer = createPlayerResolver();

  let sched;
  try {
    sched = await apiWebSchedule(ymd);
  } catch (e) {
    logger.error("[updateNhlLiveGames] apiWebSchedule failed", { ymd, error: e?.message || String(e) });
    return;
  }

  const day = Array.isArray(sched?.gameWeek) ? sched.gameWeek.find((d) => d?.date === ymd) : null;
  const games = day ? day.games || [] : Array.isArray(sched?.games) ? sched.games : [];

  logger.info("[updateNhlLiveGames] games found", { ymd, count: games.length });

  for (const g of games) {
    const gameId = String(g?.id || "");
    if (!gameId) continue;

    const gameRef = db.collection("nhl_live_games").doc(gameId);

    try {
      const homeAbbr = normTeamAbbr(g.homeTeam?.abbrev || g.homeTeamAbbrev || g.homeTeam);
      const awayAbbr = normTeamAbbr(g.awayTeam?.abbrev || g.awayTeamAbbrev || g.awayTeam);

      const homeScore = g.homeTeam?.score ?? g.homeScore ?? 0;
      const awayScore = g.awayTeam?.score ?? g.awayScore ?? 0;

      const state = String(g.gameState || g.gameScheduleState || "");
      const isLive = ["LIVE", "CRIT", "STARTED"].includes(state);
      const isFinal = ["FINAL", "OFF"].includes(state);

      const schedPeriod = g.periodDescriptor?.number ?? null;
      const schedPeriodType = g.periodDescriptor?.periodType ?? null;

      // Schedule clock
      const schedClock = g.clock && typeof g.clock === "object" ? g.clock : null;
      let schedTimeRemaining = null;
      let schedSecondsRemaining = null;
      let schedClockRunning = null;
      let schedInIntermission = null;
      const schedDisplayPeriod = typeof g.displayPeriod === "number" ? g.displayPeriod : null;
      const schedMaxPeriods = typeof g.maxPeriods === "number" ? g.maxPeriods : null;

      if (schedClock) {
        if (typeof schedClock.timeRemaining === "string" && schedClock.timeRemaining.trim()) {
          schedTimeRemaining = schedClock.timeRemaining.trim();
        } else if (typeof schedClock.secondsRemaining === "number") {
          schedTimeRemaining = formatSecondsToMmSs(schedClock.secondsRemaining);
        }
        if (typeof schedClock.secondsRemaining === "number") schedSecondsRemaining = schedClock.secondsRemaining;
        if (typeof schedClock.running === "boolean") schedClockRunning = schedClock.running;
        if (typeof schedClock.inIntermission === "boolean") schedInIntermission = schedClock.inIntermission;
      }

      // Write base (IMPORTANT: write BOTH ymd and date for compatibility)
      const baseUpdate = {
        gameId,
        ymd,       // ✅ new
        date: ymd, // ✅ legacy compatibility
        homeAbbr,
        awayAbbr,
        homeScore,
        awayScore,
        startTimeUTC: g.startTimeUTC || g.startTimeUtc || null,
        state,
        isLive,
        isFinal,
        period: schedPeriod,
        periodType: schedPeriodType,
        venue: g.venue?.default || g.venueName || null,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await gameRef.set(baseUpdate, { merge: true });

      // PBP for live/final
      let pbp = null;
      if (isLive || isFinal) {
        try {
          pbp = await apiWebPbp(gameId);
        } catch (err) {
          logger.warn("[updateNhlLiveGames] apiWebPbp failed", { gameId, error: err?.message || String(err) });
        }
      }

      // PBP clock
      let pbpTimeRemaining = null;
      let pbpSecondsRemaining = null;
      let pbpClockRunning = null;
      let pbpInIntermission = null;
      let pbpDisplayPeriod = null;
      let pbpMaxPeriods = null;
      let pbpPeriod = null;
      let pbpPeriodType = null;

      if (pbp && typeof pbp === "object") {
        if (pbp.clock && typeof pbp.clock === "object") {
          const c = pbp.clock;
          if (typeof c.timeRemaining === "string" && c.timeRemaining.trim()) {
            pbpTimeRemaining = c.timeRemaining.trim();
          } else if (typeof c.secondsRemaining === "number") {
            pbpTimeRemaining = formatSecondsToMmSs(c.secondsRemaining);
          }
          if (typeof c.secondsRemaining === "number") pbpSecondsRemaining = c.secondsRemaining;
          if (typeof c.running === "boolean") pbpClockRunning = c.running;
          if (typeof c.inIntermission === "boolean") pbpInIntermission = c.inIntermission;
        }
        if (typeof pbp.displayPeriod === "number") pbpDisplayPeriod = pbp.displayPeriod;
        if (typeof pbp.maxPeriods === "number") pbpMaxPeriods = pbp.maxPeriods;

        if (pbp.periodDescriptor && typeof pbp.periodDescriptor === "object") {
          pbpPeriod = pbp.periodDescriptor.number ?? null;
          pbpPeriodType = pbp.periodDescriptor.periodType ?? null;
        }
      }

      // Merge clock (don’t overwrite with null)
      let timeRemaining = null;
      let secondsRemaining = null;
      let clockRunning = null;
      let inIntermission = null;
      let displayPeriod = null;
      let maxPeriods = null;
      let finalPeriod = null;
      let finalPeriodType = null;

      if (isFinal) {
        timeRemaining = "00:00";
        secondsRemaining = 0;
        clockRunning = false;
        inIntermission = false;
        displayPeriod = pbpDisplayPeriod ?? schedDisplayPeriod ?? null;
        maxPeriods = pbpMaxPeriods ?? schedMaxPeriods ?? null;
        finalPeriod = pbpPeriod ?? schedPeriod ?? null;
        finalPeriodType = pbpPeriodType ?? schedPeriodType ?? null;
      } else {
        timeRemaining = pbpTimeRemaining ?? schedTimeRemaining ?? null;
        secondsRemaining = pbpSecondsRemaining ?? schedSecondsRemaining ?? null;
        clockRunning = pbpClockRunning ?? schedClockRunning ?? null;
        inIntermission = pbpInIntermission ?? schedInIntermission ?? null;
        displayPeriod = pbpDisplayPeriod ?? schedDisplayPeriod ?? null;
        maxPeriods = pbpMaxPeriods ?? schedMaxPeriods ?? null;
        finalPeriod = pbpPeriod ?? schedPeriod ?? null;
        finalPeriodType = pbpPeriodType ?? schedPeriodType ?? null;
      }

      const clockPatch = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (finalPeriod !== null) clockPatch.period = finalPeriod;
      if (finalPeriodType !== null) clockPatch.periodType = finalPeriodType;

      if (timeRemaining !== null) clockPatch.timeRemaining = timeRemaining;
      if (secondsRemaining !== null) clockPatch.secondsRemaining = secondsRemaining;
      if (clockRunning !== null) clockPatch.clockRunning = clockRunning;
      if (inIntermission !== null) clockPatch.inIntermission = inIntermission;
      if (displayPeriod !== null) clockPatch.displayPeriod = displayPeriod;
      if (maxPeriods !== null) clockPatch.maxPeriods = maxPeriods;

      await gameRef.set(clockPatch, { merge: true });

      logger.info("[updateNhlLiveGames] clock-update", {
        gameId,
        state,
        timeRemaining,
        secondsRemaining,
        clockRunning,
        inIntermission,
        displayPeriod,
        maxPeriods,
        period: finalPeriod,
        periodType: finalPeriodType,
      });

      // No goals if not live/final
      if (!isLive && !isFinal) continue;
      if (!pbp) continue;

      const plays = extractPlays(pbp);
      if (!plays.length) {
        logger.warn("[updateNhlLiveGames] pbp plays empty", {
          gameId,
          keys: Object.keys(pbp || {}),
        });
        continue;
      }

      const pbpGoalIds = new Set();
      let goalCount = 0;

      for (const play of plays) {
        if (!isGoalPlay(play)) continue;

        // Exclure SO
        const playPeriodType = String(play?.periodDescriptor?.periodType || "").toUpperCase();
        if (playPeriodType === "SO") continue;

        const det = play?.details || {};
        const eventId = String(play?.eventId || "");
        if (!eventId) continue;

        pbpGoalIds.add(eventId);
        goalCount++;

        // Team abbrev : plusieurs clés possibles
        let teamAbbr = normTeamAbbr(det.teamAbbrev || det.eventOwnerTeamAbbrev || det.teamAbbr);

        // IDs & fallback names (robuste)
        const scoringPlayerIdRaw = det.scoringPlayerId || det.scorerPlayerId || det.playerId || null;
        const scoringBackupName =
          det.scoringPlayerName?.default ||
          det.scoringPlayerName ||
          det.scorerName?.default ||
          det.scorerName ||
          det.playerName?.default ||
          det.playerName ||
          null;

        const assist1PlayerIdRaw = det.assist1PlayerId || null;
        const assist1BackupName = det.assist1PlayerName?.default || det.assist1PlayerName || null;

        const assist2PlayerIdRaw = det.assist2PlayerId || null;
        const assist2BackupName = det.assist2PlayerName?.default || det.assist2PlayerName || null;

        const scoringPlayerId = normalizePlayerId(scoringPlayerIdRaw);
        const assist1PlayerId = normalizePlayerId(assist1PlayerIdRaw);
        const assist2PlayerId = normalizePlayerId(assist2PlayerIdRaw);

        const scoring = await resolvePlayer(scoringPlayerId, scoringBackupName);
        const assist1 = await resolvePlayer(assist1PlayerId, assist1BackupName);
        const assist2 = await resolvePlayer(assist2PlayerId, assist2BackupName);

        if (!teamAbbr && scoring.teamAbbr) teamAbbr = scoring.teamAbbr;

        const scoringPlayerTotal = det.scoringPlayerTotal ?? null;
        const periodNumber = play?.periodDescriptor?.number ?? null;

        const timeInPeriod =
          det.timeInPeriod ||
          play.timeInPeriod ||
          det.timeRemaining ||
          play.timeRemaining ||
          null;

        const strength = det.strength ?? null;

        const scoringPlayerAvatarUrl =
          scoring.teamAbbr && scoringPlayerId
            ? `https://assets.nhle.com/mugs/nhl/${NHL_HEADSHOT_SEASON}/${scoring.teamAbbr}/${scoringPlayerId}.png`
            : null;

        const assist1PlayerAvatarUrl =
          assist1.teamAbbr && assist1PlayerId
            ? `https://assets.nhle.com/mugs/nhl/${NHL_HEADSHOT_SEASON}/${assist1.teamAbbr}/${assist1PlayerId}.png`
            : null;

        const assist2PlayerAvatarUrl =
          assist2.teamAbbr && assist2PlayerId
            ? `https://assets.nhle.com/mugs/nhl/${NHL_HEADSHOT_SEASON}/${assist2.teamAbbr}/${assist2PlayerId}.png`
            : null;

        const goalDoc = {
          eventId,
          gameId,
          ymd,       // ✅ new
          date: ymd, // ✅ legacy
          teamAbbr,
          period: periodNumber,
          periodType: playPeriodType,
          timeInPeriod,
          strength,

          scoringPlayerId,
          scoringPlayerName: scoring.name,
          scoringPlayerTotal,
          scoringPlayerTeamAbbr: scoring.teamAbbr || null,
          scoringPlayerAvatarUrl,

          assist1PlayerId,
          assist1PlayerName: assist1.name,
          assist1PlayerTeamAbbr: assist1.teamAbbr || null,
          assist1PlayerAvatarUrl,

          assist2PlayerId,
          assist2PlayerName: assist2.name,
          assist2PlayerTeamAbbr: assist2.teamAbbr || null,
          assist2PlayerAvatarUrl,

          updatedAt: FieldValue.serverTimestamp(),

          // debug light (tu peux enlever plus tard)
          // raw: play,
        };

        await gameRef.collection("goals").doc(eventId).set(goalDoc, { merge: true });
      }

      logger.info("[updateNhlLiveGames] goals-upsert", { gameId, goalCount });

      // Ghost cleanup
      try {
        const goalsSnap = await gameRef.collection("goals").get();
        for (const docSnap of goalsSnap.docs) {
          if (!pbpGoalIds.has(docSnap.id)) {
            await docSnap.ref.delete();
          }
        }
      } catch (err) {
        logger.warn("[updateNhlLiveGames] ghost cleanup failed", { gameId, error: err?.message || String(err) });
      }
    } catch (err) {
      logger.error("[updateNhlLiveGames] game failed", { gameId, error: err?.message || String(err) });
      continue;
    }
  }

  logger.info("[updateNhlLiveGames] done", { ymd });
}

// ---------- Exports ----------
export const updateNhlLiveGamesNow = onCall({ region: "us-central1" }, async (request) => {
  const ymd =
    typeof request?.data?.date === "string" && request.data.date.length >= 10
      ? request.data.date.slice(0, 10)
      : null;

  await runUpdateNhlLiveGames(ymd);
  return { ok: true, ymd: ymd || todayAppYmd() };
});

export const updateNhlLiveGamesCron = onSchedule(
  {
    schedule: "*/1 * * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    const todayYmd = todayAppYmd();
    const hour = torontoCurrentHour();

    if (hour < 3) {
      const yesterdayYmd = addDaysToYmd(todayYmd, -1);
      await runUpdateNhlLiveGames(yesterdayYmd);
    }

    await runUpdateNhlLiveGames(todayYmd);
  }
);