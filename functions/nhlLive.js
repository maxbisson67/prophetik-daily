// functions/nhlLive.js
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  db,
  FieldValue,
  logger,
  apiWebSchedule,
  apiWebPbp,
  torontoYMD,
} from "./utils.js";

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


function addDaysToYMD(baseYmd, delta) {
  if (!baseYmd || typeof baseYmd !== "string" || baseYmd.length < 10) {
    return baseYmd;
  }
  const [y, m, d] = baseYmd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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
      : torontoYMD();

  logger.info("[updateNhlLiveGames] tick", { ymd, forYmd });

  // Initialiser le resolver joueur (cache en mémoire par exécution)
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

    // --- Infos de base du match ---
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

    // ⏱ clock du schedule (souvent incomplet / absent)
    const clock = g.clock && typeof g.clock === "object" ? g.clock : null;

    // 🕒 version "schedule" de timeRemaining (souvent null)
    let timeRemainingSchedule = null;
    if (clock && "timeRemaining" in clock) {
      timeRemainingSchedule =
        clock.timeRemaining != null ? clock.timeRemaining : null;
    }

    const venue = g.venue?.default || g.venueName || null;

    const gameRef = db.collection("nhl_live_games").doc(gameId);

    // 2) Écrire / mettre à jour le doc principal du match (version schedule only)
    await gameRef.set(
      {
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
        timeRemaining: timeRemainingSchedule, // 🔒 jamais undefined
        venue,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Si le match n'est pas live ni final, on n'a pas besoin du PBP
    if (!isLive && !isFinal) continue;

    // 3) PBP: pour aller chercher les buts détaillés + clock live
    let pbp;
    try {
      pbp = await apiWebPbp(gameId);
    } catch (err) {
      logger.warn("[updateNhlLiveGames] apiWebPbp failed", {
        gameId,
        error: err.message,
      });
      continue;
    }

    const plays = Array.isArray(pbp?.plays) ? pbp.plays : [];
    logger.info("[updateNhlLiveGames] plays", { gameId, count: plays.length });

    // 🕒 timeRemaining calculé à partir du PBP
    // On part de la valeur "schedule"
    let pbpTimeRemaining = timeRemainingSchedule;

    // 3a) Si le PBP expose un clock global avec timeRemaining, on le prend
    if (
      pbp &&
      typeof pbp === "object" &&
      pbp.clock &&
      typeof pbp.clock === "object" &&
      typeof pbp.clock.timeRemaining === "string" &&
      pbp.clock.timeRemaining.trim() !== ""
    ) {
      pbpTimeRemaining = pbp.clock.timeRemaining.trim();
    } else if (isLive && plays.length > 0) {
      // 3b) Sinon, on essaie de déduire le dernier timeRemaining des plays
      let lastTime = null;
      for (const play of plays) {
        const det = play?.details || {};
        const t =
          (typeof det.timeRemaining === "string" && det.timeRemaining.trim()) ||
          (typeof play.timeRemaining === "string" && play.timeRemaining.trim()) ||
          null;
        if (t) {
          lastTime = t;
        }
      }
      if (lastTime) {
        pbpTimeRemaining = lastTime;
      }
    }

    // 3c) Si on a trouvé mieux que la valeur "schedule", on réécrit timeRemaining
    if (pbpTimeRemaining !== timeRemainingSchedule) {
      await gameRef.set(
        { timeRemaining: pbpTimeRemaining ?? null },
        { merge: true }
      );
    }

    // 4) Traitement des buts (comme avant)
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

      // teamAbbr depuis le play (équipe qui marque), sera éventuellement fallbacké
      let teamAbbr = normTeamAbbr(det.teamAbbrev);

      // --- IDs & fallback names venant de l’API NHL ---
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

      // 🔎 Résolution des joueurs via /nhl_players/{id}, avec fallback API
      const scoring = await resolvePlayer(scoringPlayerId, scoringBackupName);
      const assist1 = await resolvePlayer(assist1PlayerId, assist1BackupName);
      const assist2 = await resolvePlayer(assist2PlayerId, assist2BackupName);

      // Si on n’a pas d’équipe dans le play, on peut utiliser l’équipe du buteur
      if (!teamAbbr && scoring.teamAbbr) {
        teamAbbr = scoring.teamAbbr;
      }

      // ⭐ Nombre total de buts du buteur (dans le match/saison selon l’API)
      const scoringPlayerTotal =
        det.scoringPlayerTotal ??
        det.scoringPlayerTotal?.default ??
        null;

      const periodNumber = play.periodDescriptor?.number ?? null;

      // Essayer plusieurs champs pour le temps dans la période (pour l’affichage des buts)
      const timeInPeriod =
        det.timeInPeriod ||
        det.timeInPeriod?.default ||
        play.timeInPeriod ||
        det.timeRemaining ||
        play.timeRemaining ||
        null;

      const strength = det.strength ?? null;

      // 🔗 URLs d’avatar (buteur et passeurs)
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
    const effective = ymd || torontoYMD();
    return { ok: true, ymd: effective };
  }
);

export const updateNhlLiveGamesCron = onSchedule(
  {
    schedule: "*/1 * * * *", // toutes les minutes
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    const todayYmd = torontoYMD();
    const hour = torontoCurrentHour();

    // 🔁 Jusqu'à 3h du matin (heure Toronto), on continue aussi d’updater la veille
    if (hour < 3) {
      const yesterdayYmd = addDaysToYMD(todayYmd, -1);
      await runUpdateNhlLiveGames(yesterdayYmd);
    }

    // Dans tous les cas, on update le jour courant
    await runUpdateNhlLiveGames(todayYmd);
  }
);