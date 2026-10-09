import { db } from "../../../utils.js";
import {
  buildFgcCurrentPickFromPlayer,
  resolveFgcPlayerFocus,
} from "../resolveFgcPlayerFocus.js";
import { resolveFgcNhlStatsSeasonForChallenge } from "../resolveFgcNhlStatsSeason.js";

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return str(v).toUpperCase();
}

function resolveGameDateYmd(challenge = {}) {
  const ymd = str(challenge.gameYmd);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;

  const start = challenge.gameStartTimeUTC?.toDate?.();
  if (!start) return "";

  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, "0");
  const day = String(start.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pickNhlStats(stats = {}) {
  const goals = Number(stats.goals) || 0;
  const assists = Number(stats.assists) || 0;
  const points = Number(stats.points) || goals + assists;
  const gamesPlayed = Number(stats.gamesPlayed) || 0;
  const pointsPerGame =
    Number(stats.pointsPerGame) || (gamesPlayed > 0 ? points / gamesPlayed : 0);

  return {
    goals,
    assists,
    points,
    gamesPlayed,
    pointsPerGame,
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

/**
 * Contexte vérifié — FGC NHL uniquement (MVP).
 */
export class FgcNhlContextBuilder {
  /**
   * @param {{ uid: string, challengeId?: string, playerIds?: string[] }}
   */
  async build({ uid, challengeId, playerIds = [] }) {
    const cid = str(challengeId);
    if (!cid) {
      throw new Error("CHALLENGE_ID_REQUIRED");
    }

    const chSnap = await db.doc(`first_goal_challenges/${cid}`).get();
    if (!chSnap.exists) {
      throw new Error("CHALLENGE_NOT_FOUND");
    }

    const ch = chSnap.data() || {};
    const league = safeAbbr(ch.league || "NHL");

    if (league !== "NHL") {
      throw new Error("FGC_NHL_ONLY");
    }

    const entrySnap = uid ? await db.doc(`first_goal_challenges/${cid}/entries/${uid}`).get() : null;
    const entry = entrySnap?.exists ? entrySnap.data() || {} : null;

    const homeAbbr = safeAbbr(ch.homeAbbr);
    const awayAbbr = safeAbbr(ch.awayAbbr);
    const gameDateYmd = resolveGameDateYmd(ch);

    const seasonCfgSnap = await db.doc("app_config/currentSeason").get();
    const seasonConfig = seasonCfgSnap.exists ? seasonCfgSnap.data() || {} : null;

    const statsMeta = await resolveFgcNhlStatsSeasonForChallenge({
      gameDateYmd,
      homeAbbr,
      awayAbbr,
      seasonConfig,
    });
    const statsSeasonId = statsMeta.statsSeasonId;

    const { ids, focusPlayerId } = resolveFgcPlayerFocus(playerIds, entry?.playerId);

    const players = [];
    for (const pid of ids) {
      const row = await this.loadPlayerContext(pid, statsSeasonId, {
        homeAbbr,
        awayAbbr,
      });
      if (row) players.push(row);
    }

    const focusPlayer =
      players.find((p) => p.playerId === focusPlayerId) || players[0] || null;

    return {
      domain: "fgc",
      sport: "NHL",
      challenge: {
        id: cid,
        status: str(ch.status).toLowerCase() || "open",
        groupId: str(ch.groupId) || null,
        gameId: str(ch.gameId) || null,
        gameYmd: str(ch.gameYmd) || null,
        homeAbbr,
        awayAbbr,
        gameStartTimeUTC: ch.gameStartTimeUTC?.toDate?.()?.toISOString?.() || null,
      },
      participant: {
        uid,
        savedPick: entry?.playerId
          ? {
              playerId: str(entry.playerId),
              playerName: str(entry.playerName) || null,
              teamAbbr: safeAbbr(entry.teamAbbr) || null,
            }
          : null,
        currentPick: buildFgcCurrentPickFromPlayer(focusPlayer),
      },
      players,
      seasonId: statsMeta.calendarSeasonId,
      statsSeasonId,
      statsUsesPreviousSeason: statsMeta.statsUsesPreviousSeason,
      previousSeasonId: statsMeta.previousSeasonId || null,
      statsSeasonNote: statsMeta.statsUsesPreviousSeason
        ? "season_stats_from_previous_until_representative_current_sample"
        : "season_stats_from_current",
    };
  }

  async loadPlayerContext(playerId, seasonId, { homeAbbr, awayAbbr }) {
    const pid = str(playerId);
    if (!pid) return null;

    const statsRef = db.doc(`nhl_player_stats_current/${seasonId}_${pid}`);
    const statsSnap = await statsRef.get();
    const statsRow = statsSnap.exists ? statsSnap.data() || {} : {};

    const playerSnap = await db.doc(`nhl_players/${pid}`).get();
    const player = playerSnap.exists ? playerSnap.data() || {} : {};

    const teamAbbr = safeAbbr(statsRow.teamAbbr || player.teamAbbr || player.team);
    const injury = normalizeInjury(player.injury || statsRow.injury);

    const opposingTeamAbbr =
      teamAbbr && teamAbbr === homeAbbr ? awayAbbr : teamAbbr && teamAbbr === awayAbbr ? homeAbbr : null;

    return {
      playerId: pid,
      fullName: str(player.fullName || player.name || statsRow.fullName) || pid,
      teamAbbr,
      position: str(player.positionCode || player.position) || null,
      isHomeTeam: teamAbbr && teamAbbr === homeAbbr,
      isAwayTeam: teamAbbr && teamAbbr === awayAbbr,
      opposingTeamAbbr,
      seasonStats: pickNhlStats(statsRow),
      statsSeasonId: str(seasonId),
      injury,
    };
  }
}
