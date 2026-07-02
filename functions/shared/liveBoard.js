/**
 * L2 — Doc agrégé live_board_{nhl|mlb}/{ymd}
 */

import { db, FieldValue } from "../utils.js";
import { liveBoardCollection } from "./liveControl.js";

const BOARD_VERSION = 1;

export function compactNhlBoardEntry(doc = {}, gameId = "") {
  const id = String(gameId || doc.gameId || doc.id || "");
  return {
    id,
    gameId: id,
    ymd: doc.ymd || doc.date || null,
    awayAbbr: doc.awayAbbr || null,
    homeAbbr: doc.homeAbbr || null,
    awayScore: doc.awayScore ?? null,
    homeScore: doc.homeScore ?? null,
    state: doc.state || null,
    isLive: !!doc.isLive,
    isFinal: !!doc.isFinal,
    period: doc.period ?? null,
    periodType: doc.periodType || null,
    timeRemaining: doc.timeRemaining || null,
    secondsRemaining: doc.secondsRemaining ?? null,
    clockRunning: doc.clockRunning ?? null,
    inIntermission: doc.inIntermission ?? null,
    displayPeriod: doc.displayPeriod ?? null,
    startTimeUTC: doc.startTimeUTC || null,
    venue: doc.venue || null,
  };
}

export function compactMlbBoardEntry(doc = {}, gamePk = "") {
  const id = String(gamePk || doc.gamePk || doc.id || "");
  return {
    id,
    gamePk: id,
    ymd: doc.ymd || doc.date || null,
    awayAbbr: doc.awayAbbr || null,
    homeAbbr: doc.homeAbbr || null,
    awayScore: doc.awayScore ?? null,
    homeScore: doc.homeScore ?? null,
    isLive: !!doc.isLive,
    isFinal: !!doc.isFinal,
    isPostponed: !!doc.isPostponed,
    currentInning: doc.currentInning ?? null,
    currentInningOrdinal: doc.currentInningOrdinal || null,
    inningState: doc.inningState || null,
    inningHalf: doc.inningHalf || null,
    abstractGameState: doc.abstractGameState || null,
    detailedState: doc.detailedState || null,
    balls: doc.balls ?? null,
    strikes: doc.strikes ?? null,
    outs: doc.outs ?? null,
    onFirst: !!doc.onFirst,
    onSecond: !!doc.onSecond,
    onThird: !!doc.onThird,
    runnersOnBase: doc.runnersOnBase ?? null,
    startTimeUTC: doc.startTimeUTC || null,
    venue: doc.venue || null,
  };
}

export function buildNhlBoardEntryFromSchedule(g = {}, ymd) {
  const gameId = String(g?.id || "");
  const homeAbbr = String(g.homeTeam?.abbrev || g.homeTeamAbbrev || g.homeTeam || "").toUpperCase() || null;
  const awayAbbr = String(g.awayTeam?.abbrev || g.awayTeamAbbrev || g.awayTeam || "").toUpperCase() || null;
  const state = String(g.gameState || g.gameScheduleState || "");

  return compactNhlBoardEntry(
    {
      gameId,
      ymd,
      homeAbbr,
      awayAbbr,
      homeScore: g.homeTeam?.score ?? g.homeScore ?? 0,
      awayScore: g.awayTeam?.score ?? g.awayScore ?? 0,
      state,
      isLive: ["LIVE", "CRIT", "STARTED"].includes(state.toUpperCase()),
      isFinal: ["FINAL", "OFF"].includes(state.toUpperCase()),
      period: g.periodDescriptor?.number ?? null,
      periodType: g.periodDescriptor?.periodType ?? null,
      startTimeUTC: g.startTimeUTC || g.startTimeUtc || null,
      venue: g.venue?.default || g.venueName || null,
    },
    gameId
  );
}

export async function upsertLiveBoard(league, ymd, games = []) {
  const col = liveBoardCollection(league);
  const sorted = [...games].sort((a, b) => {
    const ta = a?.startTimeUTC ? new Date(a.startTimeUTC).getTime() : 0;
    const tb = b?.startTimeUTC ? new Date(b.startTimeUTC).getTime() : 0;
    return ta - tb;
  });

  await db
    .collection(col)
    .doc(String(ymd))
    .set(
      {
        league: String(league || "").toLowerCase(),
        ymd,
        version: BOARD_VERSION,
        gameCount: sorted.length,
        games: sorted,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
