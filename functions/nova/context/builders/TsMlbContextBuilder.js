/**
 * Contexte vérifié — TS MLB (Le Trio du jour).
 */
import { db } from "../../../utils.js";
import { getMlbCurrentSeason } from "../../../players/seasonHelpers.js";
import {
  buildEmptyMlbPitcher,
} from "../../../mlb/mlbProbablePitchers.js";
import {
  compactBvpForClient,
  isBvpActionableForCoach,
} from "../../../mlb/mlbBvpStats.js";
import { enrichPitcherThrowHand } from "../../../mlb/mlbPersonHands.js";
import { resolveBallparkForVenue } from "../../../mlb/ballparkCatalog.js";
import {
  buildOffensiveEnvironmentBlock,
  computeParkOffenseScore,
  computeParkTempContextScore,
  computeSpecialContextScore,
  computeTemperatureScore,
  scoreToLabel,
} from "../../../mlb/gameConditionsScoring.js";
import { resolveFgcPlayerFocus } from "../resolveFgcPlayerFocus.js";

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return str(v).toUpperCase();
}

function ymdCompact(ymd) {
  return str(ymd).replaceAll("-", "");
}

function normalizePitcher(raw) {
  const base = buildEmptyMlbPitcher();
  if (!raw || typeof raw !== "object") return base;
  const idNum = Number(raw.id);
  return {
    id: Number.isFinite(idNum) ? idNum : null,
    name: str(raw.name || raw.fullName) || null,
    wins: raw.wins ?? null,
    losses: raw.losses ?? null,
    era: raw.era ?? null,
    throwHand: raw.throwHand ?? null,
  };
}

function pickTsSeasonStats(pool = {}) {
  return {
    hits: Number(pool.hits) || 0,
    rbi: Number(pool.rbi) || 0,
    runs: Number(pool.runs) || 0,
    homeRuns: Number(pool.homeRuns) || 0,
    doubles: Number(pool.doubles) || 0,
    triples: Number(pool.triples) || 0,
    slg: pool.slg ?? null,
    ops: pool.ops ?? null,
    battingAverage: pool.battingAverage ?? null,
    gamesPlayed: Number(pool.gamesPlayed) || 0,
    pointsPerGame: Number(pool.pointsPerGame) || 0,
  };
}

function normalizeInjury(raw) {
  if (!raw || typeof raw !== "object") return null;
  const status = str(raw.status || raw.strStatus).toLowerCase();
  if (!status) return null;
  return {
    status,
    description: str(raw.description || raw.strInjury) || null,
  };
}

function buildOffensiveEnvironmentFromDoc(data) {
  if (!data || typeof data !== "object") return null;

  const base =
    data.offensiveEnvironment && typeof data.offensiveEnvironment === "object"
      ? { ...data.offensiveEnvironment }
      : {};

  if (data.offensiveEnvironmentScore != null || data.explanationFr) {
    Object.assign(base, {
      score: base.score ?? data.offensiveEnvironmentScore ?? null,
      label: base.label ?? data.offensiveEnvironmentLabel ?? null,
      parkScore: base.parkScore ?? data.parkOffenseScore ?? null,
      weatherScore: base.weatherScore ?? data.weatherOffenseScore ?? null,
      specialScore: base.specialScore ?? data.specialContextScore ?? null,
      explanationFr: base.explanationFr || data.explanationFr || "",
      explanationEn: base.explanationEn || data.explanationEn || "",
      temperatureScore:
        base.temperatureScore ??
        data.temperatureScore ??
        null,
      temperatureCelsius:
        base.temperatureCelsius ??
        (Number.isFinite(Number(data.temperatureCelsius))
          ? Math.round(Number(data.temperatureCelsius))
          : null),
      ballparkName: base.ballparkName || data.ballparkName || null,
      parkFactorHomeRuns: base.parkFactorHomeRuns ?? data.parkFactorHomeRuns ?? null,
      altitudeMeters: base.altitudeMeters ?? data.altitudeMeters ?? null,
      windSpeedKmh:
        base.windSpeedKmh ??
        (Number.isFinite(Number(data.windSpeedKmh)) ? Math.round(Number(data.windSpeedKmh)) : null),
      windDirectionText: base.windDirectionText || data.windDirectionText || null,
      roofState: base.roofState || data.roofState || null,
      weatherNeutralized:
        base.weatherNeutralized === true ||
        data.roofState === "closed" ||
        false,
    });
  }

  if (base.score == null && !base.explanationFr && base.parkScore == null) return null;

  if (base.temperatureScore == null && base.temperatureCelsius != null) {
    base.temperatureScore = computeTemperatureScore(base.temperatureCelsius);
  }
  if (base.contextScore == null) {
    base.contextScore = computeParkTempContextScore(
      base.parkScore,
      base.temperatureScore,
      base.weatherNeutralized
    );
  }
  if (base.contextLabel == null && base.contextScore != null) {
    base.contextLabel = scoreToLabel(base.contextScore);
  }

  return base;
}

async function loadScheduleGameDoc(gamePk, gameDateYmd, poolPlayer) {
  const ymd = str(gameDateYmd);
  const pk = str(gamePk);
  if (pk && ymd) {
    const direct = await db.doc(`mlb_schedule_daily/${ymdCompact(ymd)}/games/${pk}`).get();
    if (direct.exists) return { id: direct.id, ...(direct.data() || {}) };
  }

  const away = safeAbbr(poolPlayer?.awayAbbr);
  const home = safeAbbr(poolPlayer?.homeAbbr);
  if (!away || !home || !ymd) return null;

  const snap = await db.collection(`mlb_schedule_daily/${ymdCompact(ymd)}/games`).get();
  for (const doc of snap.docs) {
    const g = doc.data() || {};
    if (
      safeAbbr(g?.awayTeam?.abbreviation) === away &&
      safeAbbr(g?.homeTeam?.abbreviation) === home
    ) {
      return { id: doc.id, ...g };
    }
  }
  return null;
}

async function buildParkOnlyEnvironmentFromGame(game) {
  const venueId = Number(game?.venue?.id);
  if (!Number.isFinite(venueId)) return null;

  const ballpark = await resolveBallparkForVenue(venueId);
  if (!ballpark) return null;

  const parkOffenseScore = computeParkOffenseScore(ballpark);
  const specialContextScore = computeSpecialContextScore(ballpark);

  return buildOffensiveEnvironmentBlock({
    offensiveEnvironmentScore: null,
    offensiveEnvironmentLabel: scoreToLabel(parkOffenseScore),
    parkOffenseScore,
    weatherOffenseScore: null,
    specialContextScore,
    ballparkName: ballpark.name || null,
    parkFactorHomeRuns: ballpark.parkFactorHomeRuns ?? null,
    altitudeMeters: ballpark.altitudeMeters ?? null,
    explanationFr: `Parc : ${ballpark.name || "stade"}. Météo non disponible pour ce match.`,
    explanationEn: `Ballpark: ${ballpark.name || "venue"}. Weather unavailable for this game.`,
  });
}

async function resolveOffensiveEnvironment({ resolvedGamePk, gameDateYmd, poolPlayer }) {
  if (!resolvedGamePk) return null;

  const condRef = db.doc(`mlb_game_conditions/${resolvedGamePk}`);
  const [condSnap, scheduleGame] = await Promise.all([
    condRef.get(),
    loadScheduleGameDoc(resolvedGamePk, gameDateYmd, poolPlayer),
  ]);

  if (condSnap.exists) {
    const built = buildOffensiveEnvironmentFromDoc(condSnap.data() || {});
    if (built) return built;
  }

  if (scheduleGame) {
    return buildParkOnlyEnvironmentFromGame(scheduleGame);
  }

  return null;
}

async function resolveGamePk({ gameId, poolPlayer, gameDateYmd }) {
  const direct = str(gameId || poolPlayer?.gamePk);
  if (direct) return direct;

  const away = safeAbbr(poolPlayer?.awayAbbr);
  const home = safeAbbr(poolPlayer?.homeAbbr);
  const ymd = str(gameDateYmd);
  if (!away || !home || !ymd) return null;

  const snap = await db.collection(`mlb_schedule_daily/${ymdCompact(ymd)}/games`).get();
  for (const doc of snap.docs) {
    const g = doc.data() || {};
    if (
      safeAbbr(g?.awayTeam?.abbreviation) === away &&
      safeAbbr(g?.homeTeam?.abbreviation) === home
    ) {
      return str(doc.id || g.gamePk);
    }
  }
  return null;
}

function buildVerifiedFacts({ offensiveEnvironment, bvp, opposingPitcher, playerStats }) {
  const facts = [];
  if (offensiveEnvironment?.label) {
    facts.push(`offensive_environment_${offensiveEnvironment.label}`);
  }
  if (offensiveEnvironment?.score != null) {
    facts.push(`offensive_environment_score_${offensiveEnvironment.score}`);
  }
  if (playerStats?.slg) facts.push(`season_slg_${playerStats.slg}`);
  if (playerStats?.rbi != null) facts.push(`season_rbi_${playerStats.rbi}`);
  if (opposingPitcher?.era != null) facts.push(`opposing_starter_era_${opposingPitcher.era}`);
  if (bvp?.hasSample && isBvpActionableForCoach(bvp)) {
    facts.push(
      `bvp_career_pa_${bvp.pa}_hits_${bvp.hits}_hr_${bvp.homeRuns}_rbi_${bvp.rbi}_ops_${bvp.ops || "n/a"}`
    );
  } else if (bvp && opposingPitcher?.id) {
    facts.push("bvp_no_career_sample");
  }
  return facts;
}

export class TsMlbContextBuilder {
  async build({ uid, challengeId, playerIds = [], gameId = null }) {
    const defiId = str(challengeId);
    if (!defiId) throw new Error("CHALLENGE_ID_REQUIRED");

    const defiSnap = await db.doc(`defis/${defiId}`).get();
    if (!defiSnap.exists) throw new Error("CHALLENGE_NOT_FOUND");

    const defi = defiSnap.data() || {};
    const sport = safeAbbr(defi.sport || defi.poolSport || "MLB");
    if (sport !== "MLB") throw new Error("TS_MLB_ONLY");

    const gameDateYmd =
      str(defi.poolGameDate || defi.gameDate).slice(0, 10) ||
      str(defi.gameDate);

    const participationSnap = uid
      ? await db.doc(`defis/${defiId}/participations/${uid}`).get()
      : null;
    const participation = participationSnap?.exists ? participationSnap.data() || {} : null;
    const savedPicks = Array.isArray(participation?.picks) ? participation.picks : [];

    const { focusPlayerId } = resolveFgcPlayerFocus(playerIds, null);
    if (!focusPlayerId) throw new Error("PLAYER_ID_REQUIRED");

    const poolSnap = await db.doc(`defis/${defiId}/playerPool/${focusPlayerId}`).get();
    if (!poolSnap.exists) throw new Error("PLAYER_NOT_IN_POOL");

    const pool = poolSnap.data() || {};
    const resolvedGamePk = await resolveGamePk({
      gameId,
      poolPlayer: pool,
      gameDateYmd,
    });

    let offensiveEnvironment = await resolveOffensiveEnvironment({
      resolvedGamePk,
      gameDateYmd,
      poolPlayer: pool,
    });

    const teamAbbr = safeAbbr(pool.teamAbbr);
    const awayAbbr = safeAbbr(pool.awayAbbr);
    const homeAbbr = safeAbbr(pool.homeAbbr);
    const isHome = pool.isHome === true;
    const isAway = pool.isHome === false;

    let opposingPitcher = normalizePitcher(pool.opponentProbablePitcher);
    opposingPitcher = await enrichPitcherThrowHand(opposingPitcher);

    const bvpRaw = pool.bvpVsOpposingStarter || null;
    const bvp = bvpRaw ? compactBvpForClient(bvpRaw) : null;

    const seasonStats = pickTsSeasonStats(pool);
    const seasonId = str(pool.seasonId) || getMlbCurrentSeason(new Date(`${gameDateYmd}T12:00:00Z`));

    const player = {
      playerId: focusPlayerId,
      fullName: str(pool.fullName) || null,
      teamAbbr,
      positionCode: pool.positionCode || null,
      injury: normalizeInjury(pool.injury),
      seasonStats,
      bvpVsOpposingStarter: bvp,
    };

    const matchup = {
      gamePk: resolvedGamePk,
      gameDateYmd,
      awayAbbr,
      homeAbbr,
      playerTeamAbbr: teamAbbr,
      isHome,
      isAway,
      opposingTeamAbbr: safeAbbr(pool.opponentTeamAbbr),
      opposingPitcher,
      bvp: bvp && isBvpActionableForCoach(bvp) ? bvp : bvpRaw ? { ...bvp, actionable: false } : null,
      verifiedFacts: buildVerifiedFacts({ offensiveEnvironment, bvp, opposingPitcher, playerStats: seasonStats }),
    };

    return {
      domain: "ts",
      sport: "MLB",
      challenge: {
        id: defiId,
        groupId: defi.groupId || null,
        type: Number(defi.type) || null,
        status: str(defi.status).toLowerCase() || null,
        gameDateYmd,
        poolGameDate: gameDateYmd,
        awayAbbr,
        homeAbbr,
        gamePk: resolvedGamePk,
      },
      participant: {
        uid: uid || null,
        savedPicks: savedPicks.map((p) => ({
          playerId: str(p.playerId),
          fullName: str(p.fullName || p.playerName),
          teamAbbr: safeAbbr(p.teamAbbr),
        })),
        currentPick: {
          playerId: focusPlayerId,
          playerName: player.fullName,
          teamAbbr,
          isHome,
          isAway,
        },
      },
      offensiveEnvironment,
      matchup,
      player,
      players: [player],
      scoring: {
        summaryFr:
          "Barème TS MLB : +1 par coup sûr (H), +1 boni par extra-base (2B/3B/HR), +1 par RBI, +1 par run marqué (R).",
        summaryEn:
          "MLB TS scoring: +1 per hit (H), +1 bonus per extra-base (2B/3B/HR), +1 per RBI, +1 per run scored (R).",
      },
      seasonId,
    };
  }
}
