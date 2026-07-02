import { db } from "../../../utils.js";
import {
  buildFgcCurrentPickFromPlayer,
  resolveFgcPlayerFocus,
} from "../resolveFgcPlayerFocus.js";

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return str(v).toUpperCase();
}

function getNhlSeasonId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
}

function pickNhlStats(stats = {}) {
  return {
    goals: Number(stats.goals) || 0,
    assists: Number(stats.assists) || 0,
    points: Number(stats.points) || 0,
    gamesPlayed: Number(stats.gamesPlayed) || 0,
    pointsPerGame: Number(stats.pointsPerGame) || 0,
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

    const seasonId = getNhlSeasonId(
      ch.gameStartTimeUTC?.toDate?.() ? ch.gameStartTimeUTC.toDate() : new Date()
    );

    const { ids, focusPlayerId } = resolveFgcPlayerFocus(playerIds, entry?.playerId);

    const players = [];
    for (const pid of ids) {
      const row = await this.loadPlayerContext(pid, seasonId, {
        homeAbbr: safeAbbr(ch.homeAbbr),
        awayAbbr: safeAbbr(ch.awayAbbr),
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
        homeAbbr: safeAbbr(ch.homeAbbr),
        awayAbbr: safeAbbr(ch.awayAbbr),
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
      seasonId,
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

    return {
      playerId: pid,
      fullName: str(player.fullName || player.name || statsRow.fullName) || pid,
      teamAbbr,
      position: str(player.positionCode || player.position) || null,
      isHomeTeam: teamAbbr && teamAbbr === homeAbbr,
      isAwayTeam: teamAbbr && teamAbbr === awayAbbr,
      seasonStats: pickNhlStats(statsRow),
      injury,
    };
  }
}
