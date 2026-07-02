import { db } from "../../../utils.js";
import { getMlbCurrentSeason } from "../../../players/seasonHelpers.js";
import {
  buildEmptyMlbPitcher,
  fetchProbablePitchersForGamePk,
  mergeProbablePitcherRecord,
  pitcherRecordHasId,
} from "../../../mlb/mlbProbablePitchers.js";
import {
  bvpDocId,
  compactBvpForClient,
  isBvpActionableForCoach,
  resolveBvpStatsBatch,
} from "../../../mlb/mlbBvpStats.js";
import {
  enrichPitcherThrowHand,
  enrichProbablePitchersHands,
  fetchPersonHands,
  normalizeHand,
  resolvePitcherPersonId,
} from "../../../mlb/mlbPersonHands.js";
import {
  firstRbiLineupNote,
  lineupSlotForPlayer,
  resolveMlbGameLineups,
} from "../../../mlb/mlbGameLineups.js";
import {
  TpMlbContextBuilder,
  buildTeamFormFacts,
} from "./TpMlbContextBuilder.js";
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

function pickMlbStats(stats = {}) {
  return {
    rbi: Number(stats.rbi) || 0,
    homeRuns: Number(stats.homeRuns) || 0,
    hits: Number(stats.hits) || 0,
    gamesPlayed: Number(stats.gamesPlayed) || 0,
    battingAverage: stats.battingAverage ?? null,
    ops: stats.ops ?? null,
    runs: Number(stats.runs) || 0,
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

function normalizePitcher(raw) {
  const base = buildEmptyMlbPitcher();
  if (!raw || typeof raw !== "object") return base;

  const idRaw = resolvePitcherPersonId(raw);
  const idNum = idRaw ? Number(idRaw) : null;

  return {
    id: Number.isFinite(idNum) ? idNum : null,
    name: str(raw.name || raw.fullName) || null,
    wins: raw.wins ?? null,
    losses: raw.losses ?? null,
    era: raw.era ?? null,
    throwHand: normalizeHand(raw.throwHand || raw.pitchHand?.code || raw.pitchHand),
  };
}

function resolvePlatoonMatchup(batSide, pitchHand) {
  const bat = normalizeHand(batSide);
  const pitch = normalizeHand(pitchHand);
  if (!bat || !pitch) return null;

  if (bat === "S") {
    return {
      batterBatSide: bat,
      pitcherThrowHand: pitch,
      typicalAdvantage: "favorable",
      note: "switch_hitter",
    };
  }

  const sameSide = bat === pitch;
  return {
    batterBatSide: bat,
    pitcherThrowHand: pitch,
    typicalAdvantage: sameSide ? "unfavorable" : "favorable",
    note: sameSide ? "same_side" : "opposite_side",
  };
}

function resolveOpposingSide({ teamAbbr, homeAbbr, awayAbbr }) {
  const abbr = safeAbbr(teamAbbr);
  const home = safeAbbr(homeAbbr);
  const away = safeAbbr(awayAbbr);
  if (!abbr) return null;
  if (abbr === away) return "away";
  if (abbr === home) return "home";
  return null;
}

function buildVerifiedFacts({ isAwayTeam, platoon, opposingPitcher, opposingTeamAbbr, bvp, lineupSlot }) {
  const facts = [];

  if (isAwayTeam === true) {
    facts.push("away_bats_first_inning_top");
    facts.push("away_top1_leadoff_rbi_mostly_solo_hr");
    facts.push("away_top1_spots_3_4_5_often_best_first_rbi_paths");
  } else if (isAwayTeam === false) {
    facts.push("home_bats_second_inning_bottom");
    facts.push("home_first_rbi_only_if_visitor_scoreless_top1");
  }

  if (lineupSlot != null) {
    facts.push(`lineup_slot_${lineupSlot}`);
    if (lineupSlot === 1) facts.push("lineup_leadoff_empty_bases");
    if (lineupSlot >= 3 && lineupSlot <= 5) facts.push("lineup_heart_order");
    if (lineupSlot >= 6) facts.push("lineup_bottom_order");
  }

  if (platoon?.typicalAdvantage === "favorable") {
    facts.push("platoon_typically_favorable");
  } else if (platoon?.typicalAdvantage === "unfavorable") {
    facts.push("platoon_typically_unfavorable");
  }

  if (opposingPitcher?.throwHand) {
    facts.push(`opposing_starter_hand_${opposingPitcher.throwHand}`);
  }

  if (opposingPitcher?.name && opposingPitcher?.era != null) {
    facts.push(`opposing_starter_era_${opposingPitcher.era}`);
  }

  if (opposingTeamAbbr) {
    facts.push(`opposing_team_${opposingTeamAbbr}`);
  }

  if (bvp?.hasSample && isBvpActionableForCoach(bvp)) {
    facts.push(
      `bvp_career_pa_${bvp.pa}_hits_${bvp.hits}_hr_${bvp.homeRuns}_rbi_${bvp.rbi}_ops_${bvp.ops || "n/a"}`
    );
  } else if (bvp && opposingPitcher?.id) {
    facts.push("bvp_no_career_sample");
  }

  return facts;
}

/**
 * Contexte vérifié — FGC MLB (premier point produit).
 */
export class FgcMlbContextBuilder {
  constructor() {
    this.tpStandings = new TpMlbContextBuilder();
  }

  async build({ uid, challengeId, playerIds = [], focusPlayerHint = null }) {
    const cid = str(challengeId);
    if (!cid) throw new Error("CHALLENGE_ID_REQUIRED");

    const chSnap = await db.doc(`first_goal_challenges/${cid}`).get();
    if (!chSnap.exists) throw new Error("CHALLENGE_NOT_FOUND");

    const ch = chSnap.data() || {};
    const league = safeAbbr(ch.league || "MLB");

    if (league !== "MLB") {
      throw new Error("FGC_MLB_ONLY");
    }

    const entrySnap = uid ? await db.doc(`first_goal_challenges/${cid}/entries/${uid}`).get() : null;
    const entry = entrySnap?.exists ? entrySnap.data() || {} : null;

    const gameDate = ch.gameStartTimeUTC?.toDate?.() ? ch.gameStartTimeUTC.toDate() : new Date();
    const seasonId = getMlbCurrentSeason(gameDate);
    const gameYmd = str(ch.gameYmd);
    const gameId = str(ch.gamePk || ch.gameId);
    const homeAbbr = safeAbbr(ch.homeAbbr);
    const awayAbbr = safeAbbr(ch.awayAbbr);

    const { ids, focusPlayerId } = resolveFgcPlayerFocus(playerIds, entry?.playerId);

    const probablePitchersRaw = await this.loadProbablePitchers(ch, gameYmd, gameId, seasonId);
    const probablePitchers = await enrichProbablePitchersHands(probablePitchersRaw);
    const lineups = gameId
      ? await resolveMlbGameLineups(gameId, {
          awayAbbr,
          homeAbbr,
          beforeYmd: gameYmd,
        })
      : { away: {}, home: {}, hasLineups: false };
    const standingsMaps = await this.tpStandings.loadStandingsMaps();

    let awayTeamId = null;
    let homeTeamId = null;
    if (gameYmd && gameId) {
      const schedSnap = await db.doc(`mlb_schedule_daily/${gameYmd}/games/${gameId}`).get();
      if (schedSnap.exists) {
        const g = schedSnap.data() || {};
        awayTeamId = g.awayTeam?.id != null ? String(g.awayTeam.id) : null;
        homeTeamId = g.homeTeam?.id != null ? String(g.homeTeam.id) : null;
      }
    }

    const awayRecord = this.tpStandings.lookupRecord(standingsMaps, awayAbbr, awayTeamId);
    const homeRecord = this.tpStandings.lookupRecord(standingsMaps, homeAbbr, homeTeamId);

    const players = [];
    for (const pid of ids) {
      const row = await this.loadPlayerContext(pid, seasonId, {
        homeAbbr,
        awayAbbr,
        lineups,
      });
      if (row) players.push(row);
    }

    const currentPickPlayer =
      players.find((p) => p.playerId === focusPlayerId) || players[0] || null;

    const hintSlotRaw = focusPlayerHint?.lineupSlot;
    const hintSlot =
      hintSlotRaw != null && Number.isFinite(Number(hintSlotRaw)) ? Number(hintSlotRaw) : null;
    if (hintSlot != null && hintSlot >= 1 && hintSlot <= 9 && focusPlayerId) {
      for (const p of players) {
        if (p.playerId === focusPlayerId) {
          p.lineupSlot = hintSlot;
        }
      }
    }

    const pickTeamAbbr = safeAbbr(currentPickPlayer?.teamAbbr);
    const pickSide = resolveOpposingSide({ teamAbbr: pickTeamAbbr, homeAbbr, awayAbbr });
    const isAwayTeam = pickSide === "away" ? true : pickSide === "home" ? false : null;

    const opposingTeamAbbr = pickSide === "away" ? homeAbbr : pickSide === "home" ? awayAbbr : null;
    let opposingPitcherRaw =
      pickSide === "away" ? probablePitchers.home : pickSide === "home" ? probablePitchers.away : null;

    const hintOpp = focusPlayerHint?.opposingPitcher;
    if (hintOpp) {
      opposingPitcherRaw = mergeProbablePitcherRecord(
        opposingPitcherRaw || buildEmptyMlbPitcher(),
        normalizePitcher(hintOpp)
      );
    }

    let opposingPitcher = opposingPitcherRaw ? { ...opposingPitcherRaw } : null;
    if (opposingPitcher) {
      opposingPitcher = await enrichPitcherThrowHand(opposingPitcher);
    }

    let batterBatSide = currentPickPlayer?.batSide || null;
    if (currentPickPlayer?.playerId && !batterBatSide) {
      const hands = await fetchPersonHands(currentPickPlayer.playerId);
      batterBatSide = hands.batSide;
    }

    const platoon = resolvePlatoonMatchup(batterBatSide, opposingPitcher?.throwHand);

    const opposingTeamRecord =
      pickSide === "away"
        ? this.tpStandings.lookupRecord(standingsMaps, homeAbbr, homeTeamId)
        : pickSide === "home"
          ? this.tpStandings.lookupRecord(standingsMaps, awayAbbr, awayTeamId)
          : null;

    const opposingTeamForm = opposingTeamRecord
      ? buildTeamFormFacts(opposingTeamRecord, pickSide === "home" ? "away" : "home")
      : null;

    const opposingPitcherId = opposingPitcher?.id != null ? str(opposingPitcher.id) : "";
    let bvp = null;
    const bvpPairs = [];

    if (opposingPitcherId && currentPickPlayer?.playerId) {
      bvpPairs.push({
        batterId: currentPickPlayer.playerId,
        pitcherId: opposingPitcherId,
        batterName: currentPickPlayer.fullName,
        pitcherName: opposingPitcher?.name,
      });
    }

    for (const p of players) {
      if (!opposingPitcherId || !p?.playerId) continue;
      if (p.playerId === currentPickPlayer?.playerId) continue;
      bvpPairs.push({
        batterId: p.playerId,
        pitcherId: opposingPitcherId,
        batterName: p.fullName,
        pitcherName: opposingPitcher?.name,
      });
    }

    const bvpMap =
      bvpPairs.length > 0 ? await resolveBvpStatsBatch(bvpPairs, { maxConcurrency: 6 }) : new Map();

    if (currentPickPlayer?.playerId && opposingPitcherId) {
      const row = bvpMap.get(bvpDocId(currentPickPlayer.playerId, opposingPitcherId));
      const compact = compactBvpForClient(row);
      bvp = isBvpActionableForCoach(compact) ? compact : null;
    }

    for (const p of players) {
      if (!opposingPitcherId) continue;
      const row = bvpMap.get(bvpDocId(p.playerId, opposingPitcherId));
      p.bvpVsOpposingStarter = compactBvpForClient(row);
    }

    const lineupSlot = currentPickPlayer?.lineupSlot ?? null;
    const lineupNote =
      lineupSlot != null
        ? firstRbiLineupNote({
            lineupSlot,
            isAwayTeam,
            lang: "fr",
          })
        : null;

    const verifiedFacts = buildVerifiedFacts({
      isAwayTeam,
      platoon,
      opposingPitcher,
      opposingTeamAbbr,
      bvp,
      lineupSlot,
    });

    const matchup =
      currentPickPlayer || opposingPitcher || opposingTeamForm
        ? {
            playerTeamAbbr: pickTeamAbbr || null,
            isAwayTeam,
            batsFirstInGame: isAwayTeam === true,
            firstInningRbiDynamics: isAwayTeam
              ? {
                  halfInning: "top_1st",
                  leadoffNote: "empty_bases_solo_hr_only_rbi_path",
                  spot2Note: "more_paths_if_leadoff_on_base",
                  heartOrderNote: "spots_3_4_5_often_favored_with_runners_on",
                  lineupSlot: lineupSlot ?? null,
                  lineupNote,
                }
              : isAwayTeam === false
                ? {
                    halfInning: "bottom_1st_if_needed",
                    note: "visitor_may_score_first_rbi_in_top_1st_before_home_bats",
                    lineupSlot: lineupSlot ?? null,
                    lineupNote,
                  }
                : null,
            opposingTeamAbbr,
            opposingPitcher: opposingPitcher
              ? {
                  id: opposingPitcher.id,
                  name: opposingPitcher.name,
                  era: opposingPitcher.era,
                  wins: opposingPitcher.wins,
                  losses: opposingPitcher.losses,
                  throwHand: opposingPitcher.throwHand,
                }
              : null,
            platoon,
            opposingTeamForm,
            bvp,
            verifiedFacts,
          }
        : null;

    return {
      domain: "fgc",
      sport: "MLB",
      fgcMode: str(ch.fgcMode) || "first_rbi",
      challenge: {
        id: cid,
        status: str(ch.status).toLowerCase() || "open",
        groupId: str(ch.groupId) || null,
        gameId: gameId || null,
        gameYmd: gameYmd || null,
        homeAbbr,
        awayAbbr,
        gameStartTimeUTC: ch.gameStartTimeUTC?.toDate?.()?.toISOString?.() || null,
      },
      probablePitchers,
      teamForm: {
        away: buildTeamFormFacts(awayRecord, "away"),
        home: buildTeamFormFacts(homeRecord, "home"),
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
        currentPick: buildFgcCurrentPickFromPlayer(currentPickPlayer, {
          batSide: batterBatSide,
        }),
      },
      matchup,
      players,
      lineup: lineups.hasLineups
        ? { gamePk: gameId, away: lineups.away, home: lineups.home, source: lineups.source }
        : null,
      seasonId,
    };
  }

  async loadProbablePitchers(ch, gameYmd, gameId, seasonId) {
    let away = normalizePitcher(ch.awayProbablePitcher);
    let home = normalizePitcher(ch.homeProbablePitcher);

    if (gameYmd && gameId) {
      const schedSnap = await db.doc(`mlb_schedule_daily/${gameYmd}/games/${gameId}`).get();
      if (schedSnap.exists) {
        const g = schedSnap.data() || {};
        away = mergeProbablePitcherRecord(away, normalizePitcher(g.awayProbablePitcher));
        home = mergeProbablePitcherRecord(home, normalizePitcher(g.homeProbablePitcher));
      }
    }

    const needsApi =
      gameId && (!pitcherRecordHasId(away) || !pitcherRecordHasId(home));

    if (needsApi) {
      const api = await fetchProbablePitchersForGamePk(gameId, seasonId);
      away = mergeProbablePitcherRecord(away, normalizePitcher(api.away));
      home = mergeProbablePitcherRecord(home, normalizePitcher(api.home));
    }

    return { away, home };
  }

  async loadPlayerContext(playerId, seasonId, { homeAbbr, awayAbbr, lineups = null }) {
    const pid = str(playerId);
    if (!pid) return null;

    const statsSnap = await db.doc(`mlb_player_stats_current/${seasonId}_${pid}`).get();
    const statsRow = statsSnap.exists ? statsSnap.data() || {} : {};

    const playerSnap = await db.doc(`mlb_players/${pid}`).get();
    const player = playerSnap.exists ? playerSnap.data() || {} : {};

    const teamAbbr = safeAbbr(statsRow.teamAbbr || player.teamAbbr || player.team);
    const injury = normalizeInjury(player.injury || statsRow.injury);
    const batSide = normalizeHand(player.batSide) || null;
    const lineupSlot = lineups
      ? lineupSlotForPlayer(lineups, pid, teamAbbr, homeAbbr, awayAbbr)
      : null;

    return {
      playerId: pid,
      fullName: str(player.fullName || player.name || statsRow.fullName) || pid,
      teamAbbr,
      position: str(player.positionCode || player.position) || null,
      batSide,
      lineupSlot: lineupSlot ?? null,
      isHomeTeam: teamAbbr && teamAbbr === homeAbbr,
      isAwayTeam: teamAbbr && teamAbbr === awayAbbr,
      seasonStats: pickMlbStats(statsRow),
      injury,
    };
  }
}
