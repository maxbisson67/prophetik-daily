// functions/nhlLive.js
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  db,
  FieldValue,
  logger,
  apiWebSchedule,
  apiWebPbp,
} from "./utils.js";
import { todayAppYmd, addDaysToYmd } from "./ProphetikDate.js";

const NHL_HEADSHOT_SEASON = "20242025"; // à ajuster chaque saison

/** Normalisation du code d’équipe (abbrev) → 'MTL', 'BOS', etc. */
function normTeamAbbr(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw.toUpperCase();
  return String(raw.abbrev || raw.default || "").toUpperCase() || null;
}

/** Helper pour normaliser un id joueur → string ou null */
function normalizePlayerId(id) {
  if (id === null || id === undefined) return null;
  return String(id);
}

/**
 * Résout les infos d’un joueur via /nhl_players/{id}
 * → { id, name, teamAbbr }
 * avec cache mémoire pour limiter les lectures Firestore.
 */
function createPlayerResolver() {
  const cache = new Map(); // key = playerId string, value = { name, teamAbbr }

  return async function resolvePlayer(playerIdRaw, fallbackName = null) {
    const playerId = normalizePlayerId(playerIdRaw);
    if (!playerId) {
      return { id: null, name: fallbackName || null, teamAbbr: null };
    }

    if (cache.has(playerId)) {
      const cached = cache.get(playerId);
      return {
        id: playerId,
        name: cached.name || fallbackName || null,
        teamAbbr: cached.teamAbbr || null,
      };
    }

    let name = null;
    let teamAbbr = null;

    try {
      const snap = await db.collection("nhl_players").doc(playerId).get();
      if (snap.exists) {
        const d = snap.data() || {};
        name =
          d.fullName ||
          d.name ||
          d.full_name ||
          d.displayName ||
          fallbackName ||
          null;

        teamAbbr =
          d.teamAbbr ||
          d.currentTeamAbbr ||
          d.team ||
          null;

        if (typeof teamAbbr === "string") {
          teamAbbr = teamAbbr.toUpperCase();
        }
      } else {
        // doc absent → on utilise au moins le fallbackName
        name = fallbackName || null;
      }
    } catch (err) {
      logger.warn("[resolvePlayer] Firestore error", {
        playerId,
        error: err.message,
      });
      name = fallbackName || null;
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
  } catch (e) {
    // fallback très safe
    return 0;
  }
}

/** Format seconds → "MM:SS" pour fallback si on n’a que secondsRemaining. */
function formatSecondsToMmSs(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.floor(seconds));
  const mPart = Math.floor(s / 60);
  const sPart = s % 60;
  const mm = String(mPart).padStart(2, "0");
  const ss = String(sPart).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Tâche principale : va chercher le schedule NHL + PBP
 * et met à jour:
 *   - /nhl_live_games/{gameId}
 *   - /nhl_live_games/{gameId}/goals/{eventId}
 */
async function runUpdateNhlLiveGames(forYmd) {
  // ✅ si forYmd fourni (onCall manuel), on l’utilise, sinon date courante Toronto
  const ymd =
    typeof forYmd === "string" && forYmd.length >= 10
      ? forYmd.slice(0, 10)
      : todayAppYmd();

  logger.info("[updateNhlLiveGames] tick", { ymd, forYmd });

  // Resolver joueur (cache mémoire par exécution)
  const resolvePlayer = createPlayerResolver();

  // 1) Schedule du jour
  const sched = await apiWebSchedule(ymd);
  const day = Array.isArray(sched?.gameWeek)
    ? sched.gameWeek.find((d) => d?.date === ymd)
    : null;
  const games = day ? day.games || [] : Array.isArray(sched?.games) ? sched.games : [];

  logger.info("[updateNhlLiveGames] games found", { ymd, count: games.length });

  for (const g of games) {
    const gameId = String(g.id);
    if (!gameId) continue;

    const gameRef = db.collection("nhl_live_games").doc(gameId);

    // --- Infos de base du match depuis le schedule ---
    const homeAbbr = normTeamAbbr(
      g.homeTeam?.abbrev || g.homeTeamAbbrev || g.homeTeam
    );
    const awayAbbr = normTeamAbbr(
      g.awayTeam?.abbrev || g.awayTeamAbbrev || g.awayTeam
    );

    const homeScore = g.homeTeam?.score ?? g.homeScore ?? 0;
    const awayScore = g.awayTeam?.score ?? g.awayScore ?? 0;

    const state = String(g.gameState || g.gameScheduleState || "");
    const isLive = ["LIVE", "CRIT", "STARTED"].includes(state);
    const isFinal = ["FINAL", "OFF"].includes(state);

    const period = g.periodDescriptor?.number ?? null;
    const periodType = g.periodDescriptor?.periodType ?? null;

    // Clock depuis le SCHEDULE (si dispo)
    const schedClock = g.clock && typeof g.clock === "object" ? g.clock : null;

    let schedTimeRemaining = null;
    let schedSecondsRemaining = null;
    let schedClockRunning = null;
    let schedInIntermission = null;
    let schedDisplayPeriod =
      typeof g.displayPeriod === "number" ? g.displayPeriod : null;
    let schedMaxPeriods =
      typeof g.maxPeriods === "number" ? g.maxPeriods : null;

    if (schedClock) {
      if (
        typeof schedClock.timeRemaining === "string" &&
        schedClock.timeRemaining.trim() !== ""
      ) {
        schedTimeRemaining = schedClock.timeRemaining.trim();
      } else if (typeof schedClock.secondsRemaining === "number") {
        schedTimeRemaining = formatSecondsToMmSs(schedClock.secondsRemaining);
      }

      if (typeof schedClock.secondsRemaining === "number") {
        schedSecondsRemaining = schedClock.secondsRemaining;
      }
      if (typeof schedClock.running === "boolean") {
        schedClockRunning = schedClock.running;
      }
      if (typeof schedClock.inIntermission === "boolean") {
        schedInIntermission = schedClock.inIntermission;
      }
    }

    // 2) PBP (pour les matchs live ou terminés)
    let pbp = null;
    if (isLive || isFinal) {
      try {
        pbp = await apiWebPbp(gameId);
      } catch (err) {
        logger.warn("[updateNhlLiveGames] apiWebPbp failed", {
          gameId,
          error: err.message,
        });
      }
    }

    // Clock depuis le PBP (si dispo)
    let pbpTimeRemaining = null;
    let pbpSecondsRemaining = null;
    let pbpClockRunning = null;
    let pbpInIntermission = null;
    let pbpDisplayPeriod = null;
    let pbpMaxPeriods = null;

    if (pbp && typeof pbp === "object") {
      if (pbp.clock && typeof pbp.clock === "object") {
        const c = pbp.clock;
        if (
          typeof c.timeRemaining === "string" &&
          c.timeRemaining.trim() !== ""
        ) {
          pbpTimeRemaining = c.timeRemaining.trim();
        } else if (typeof c.secondsRemaining === "number") {
          pbpTimeRemaining = formatSecondsToMmSs(c.secondsRemaining);
        }

        if (typeof c.secondsRemaining === "number") {
          pbpSecondsRemaining = c.secondsRemaining;
        }
        if (typeof c.running === "boolean") {
          pbpClockRunning = c.running;
        }
        if (typeof c.inIntermission === "boolean") {
          pbpInIntermission = c.inIntermission;
        }
      }

      if (typeof pbp.displayPeriod === "number") {
        pbpDisplayPeriod = pbp.displayPeriod;
      }
      if (typeof pbp.maxPeriods === "number") {
        pbpMaxPeriods = pbp.maxPeriods;
      }
    }

    // 3) Fusion des sources pour le clock
    let timeRemaining = null;
    let secondsRemaining = null;
    let clockRunning = null;
    let inIntermission = null;
    let displayPeriod = null;
    let maxPeriods = null;

    if (isFinal) {
      // ✅ Match terminé → on force 00:00
      timeRemaining = "00:00";
      secondsRemaining = 0;
      clockRunning = false;
      inIntermission = false;
      displayPeriod = pbpDisplayPeriod ?? schedDisplayPeriod ?? null;
      maxPeriods = pbpMaxPeriods ?? schedMaxPeriods ?? null;
    } else {
      // ⏱ Match en cours / à venir
      // priorité PBP → fallback schedule
      timeRemaining = pbpTimeRemaining ?? schedTimeRemaining ?? null;
      secondsRemaining = pbpSecondsRemaining ?? schedSecondsRemaining ?? null;
      clockRunning = pbpClockRunning ?? schedClockRunning ?? null;
      inIntermission = pbpInIntermission ?? schedInIntermission ?? null;
      displayPeriod = pbpDisplayPeriod ?? schedDisplayPeriod ?? null;
      maxPeriods = pbpMaxPeriods ?? schedMaxPeriods ?? null;
    }

    const venue = g.venue?.default || g.venueName || null;

    // 4) Écriture Firestore
    const baseUpdate = {
      date: ymd,
      homeAbbr,
      awayAbbr,
      homeScore,
      awayScore,
      startTimeUTC: g.startTimeUTC || null,
      state,
      isLive,
      isFinal,
      period,
      periodType,
      venue,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (timeRemaining !== null) baseUpdate.timeRemaining = timeRemaining;
    if (secondsRemaining !== null) baseUpdate.secondsRemaining = secondsRemaining;
    if (clockRunning !== null) baseUpdate.clockRunning = clockRunning;
    if (inIntermission !== null) baseUpdate.inIntermission = inIntermission;
    if (displayPeriod !== null) baseUpdate.displayPeriod = displayPeriod;
    if (maxPeriods !== null) baseUpdate.maxPeriods = maxPeriods;

    await gameRef.set(baseUpdate, { merge: true });

    logger.info("[updateNhlLiveGames] clock-update", {
      gameId,
      state,
      timeRemaining,
      secondsRemaining,
      clockRunning,
      inIntermission,
      displayPeriod,
      maxPeriods,
    });

    // 5) Si pas live et pas final → pas de buts à gérer
    if (!isLive && !isFinal) continue;

    // 6) Traitement des buts si on a un PBP
    if (!pbp) continue;

    const plays = Array.isArray(pbp?.plays) ? pbp.plays : [];
    logger.info("[updateNhlLiveGames] plays", { gameId, count: plays.length });

    const pbpGoalIds = new Set();

    for (const play of plays) {
      const typeKey = String(play?.typeDescKey || "").toLowerCase();
      const typeCode = Number(play?.typeCode || 0);

      const isGoal = typeKey === "goal" || typeCode === 505;
      if (!isGoal) continue;

      // ⛔ Exclure les buts en fusillade (shootout)
      const playPeriodType = String(
        play?.periodDescriptor?.periodType || ""
      ).toUpperCase();
      if (playPeriodType === "SO") continue;

      const det = play?.details || {};
      const eventId = String(play.eventId || "");
      if (!eventId) continue;

      pbpGoalIds.add(eventId);

      let teamAbbr = normTeamAbbr(det.teamAbbrev);

      // IDs & fallback names
      const scoringPlayerIdRaw = det.scoringPlayerId || det.playerId || null;
      const scoringBackupName =
        det.scoringPlayerName?.default ||
        det.scoringPlayerName ||
        det.playerName?.default ||
        det.playerName ||
        null;

      const assist1PlayerIdRaw = det.assist1PlayerId || null;
      const assist1BackupName =
        det.assist1PlayerName?.default || det.assist1PlayerName || null;

      const assist2PlayerIdRaw = det.assist2PlayerId || null;
      const assist2BackupName =
        det.assist2PlayerName?.default || det.assist2PlayerName || null;

      const scoringPlayerId = normalizePlayerId(scoringPlayerIdRaw);
      const assist1PlayerId = normalizePlayerId(assist1PlayerIdRaw);
      const assist2PlayerId = normalizePlayerId(assist2PlayerIdRaw);

      const scoring = await resolvePlayer(scoringPlayerId, scoringBackupName);
      const assist1 = await resolvePlayer(assist1PlayerId, assist1BackupName);
      const assist2 = await resolvePlayer(assist2PlayerId, assist2BackupName);

      if (!teamAbbr && scoring.teamAbbr) {
        teamAbbr = scoring.teamAbbr;
      }

      const scoringPlayerTotal =
        det.scoringPlayerTotal ??
        det.scoringPlayerTotal?.default ??
        null;

      const periodNumber = play.periodDescriptor?.number ?? null;

      const timeInPeriod =
        det.timeInPeriod ||
        det.timeInPeriod?.default ||
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
        date: ymd,
        teamAbbr,
        period: periodNumber,
        periodType: playPeriodType,
        timeInPeriod,
        strength,

        // Buteur
        scoringPlayerId,
        scoringPlayerName: scoring.name,
        scoringPlayerTotal,
        scoringPlayerTeamAbbr: scoring.teamAbbr || null,
        scoringPlayerAvatarUrl,

        // Assist 1
        assist1PlayerId,
        assist1PlayerName: assist1.name,
        assist1PlayerTeamAbbr: assist1.teamAbbr || null,
        assist1PlayerAvatarUrl,

        // Assist 2
        assist2PlayerId,
        assist2PlayerName: assist2.name,
        assist2PlayerTeamAbbr: assist2.teamAbbr || null,
        assist2PlayerAvatarUrl,

        updatedAt: FieldValue.serverTimestamp(),
      };

      await gameRef
        .collection("goals")
        .doc(eventId)
        .set(goalDoc, { merge: true });
    }

    // 7) Nettoyage des buts fantômes
    try {
      const goalsSnap = await gameRef.collection("goals").get();
      for (const doc of goalsSnap.docs) {
        if (!pbpGoalIds.has(doc.id)) {
          logger.info("[updateNhlLiveGames] deleting ghost goal", {
            gameId,
            eventId: doc.id,
          });
          await doc.ref.delete();
        }
      }
    } catch (err) {
      logger.warn("[updateNhlLiveGames] ghost cleanup failed", {
        gameId,
        error: err.message,
      });
    }
  }

  logger.info("[updateNhlLiveGames] done", { ymd });
}

// ================== EXPORTS CF v2 ==================

export const updateNhlLiveGamesNow = onCall(
  { region: "us-central1" },
  async (request) => {
    const ymd =
      typeof request?.data?.date === "string" && request.data.date.length >= 10
        ? request.data.date.slice(0, 10)
        : null;

    await runUpdateNhlLiveGames(ymd);
    const effective = ymd || todayAppYmd();
    return { ok: true, ymd: effective };
  }
);

export const updateNhlLiveGamesCron = onSchedule(
  {
    schedule: "*/1 * * * *",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    const todayYmd = todayAppYmd();
    const hour = torontoCurrentHour();

    // 🔁 Jusqu'à 3h du matin (heure Toronto), on continue aussi d’updater la veille
    if (hour < 3) {
      const yesterdayYmd = addDaysToYmd(todayYmd, -1);
      await runUpdateNhlLiveGames(yesterdayYmd);
    }

    // Dans tous les cas, on update le jour courant
    await runUpdateNhlLiveGames(todayYmd);
  }
);