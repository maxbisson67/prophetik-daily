import { FieldValue } from "firebase-admin/firestore";
import { db, logger } from "../utils.js";
import { isFgcEntryWinner } from "../fgc/fgcEntryPoints.js";
import { resolveCompetitionForGroupCredit } from "../leaderboard/seasonCompetitions.js";
import {
  computeFirstValidGoalFromGoals,
  looksFinal,
} from "./nhlFirstGoalGoalUtils.js";

const FIRST_GOAL_GAMES_COL = "nhl_first_goal_games";

const NO_WINNER_MESSAGE =
  "Aucun but en temps réglementaire / prolongation. Aucun gagnant (shootout exclu).";

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function storedFgcPoints(entry = {}) {
  return Math.max(toNumber(entry?.payout, 0), toNumber(entry?.points, 0));
}

function dateFromYmdUTC(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0));
}

function weekKeyFromGameDate({ seasonId, fromYmd, gameDate }) {
  const fromDate = dateFromYmdUTC(fromYmd);
  const gdDate = dateFromYmdUTC(gameDate);
  if (!fromDate || !gdDate) return null;
  const delta = Math.floor((gdDate.getTime() - fromDate.getTime()) / 86400000);
  if (!Number.isFinite(delta) || delta < 0) return null;
  const weekIndex = Math.floor(delta / 7) + 1;
  return `${String(seasonId)}-W${String(weekIndex).padStart(2, "0")}`;
}

function monthKeyFromGameDate(gameDate) {
  const gd = String(gameDate || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(gd) ? gd.slice(0, 7) : null;
}

async function decrementLeaderboardFgcWin({ groupId, uid, gameYmd, points, wins = 1 }) {
  const pts = toNumber(points, 0);
  const winCount = toNumber(wins, 0);
  if (pts <= 0 && winCount <= 0) return { skipped: true, reason: "no-delta" };

  const gameDate = String(gameYmd || "").slice(0, 10);
  const comp = await resolveCompetitionForGroupCredit({ db, groupId, gameYmd: gameDate });
  if (!comp?.competitionKey) return { skipped: true, reason: "competition-closed" };

  const seasonId = String(comp.seasonId || comp.competitionKey);
  const fromYmd = String(comp.fromYmd || "");
  const weekKey = weekKeyFromGameDate({ seasonId, fromYmd, gameDate });
  const monthKey = monthKeyFromGameDate(gameDate);

  const memberRef = db.doc(
    `groups/${groupId}/leaderboards/${comp.competitionKey}/members/${uid}`
  );

  const patch = {
    uid,
    fgcVoidCorrectionAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (pts > 0) {
    const dec = FieldValue.increment(-pts);
    patch.pointsTotal = dec;
    patch.fgcPoints = dec;
    patch["families.fgc.points"] = dec;
    if (weekKey) patch[`pointsByWeek.${weekKey}`] = dec;
    if (monthKey) patch[`pointsByMonth.${monthKey}`] = dec;
  }

  if (winCount > 0) {
    const decWin = FieldValue.increment(-winCount);
    patch.wins = decWin;
    patch.fgcWins = decWin;
    patch["families.fgc.wins"] = decWin;
    if (weekKey) patch[`winsByWeek.${weekKey}`] = decWin;
    if (monthKey) patch[`winsByMonth.${monthKey}`] = decWin;
  }

  await memberRef.set(patch, { merge: true });

  return {
    decrementedPoints: pts,
    decrementedWins: winCount,
    competitionKey: comp.competitionKey,
    weekKey,
    monthKey,
  };
}

async function refreshDailyTopScoreDocs({ groupId, gameYmd }) {
  const { computeDailyGroupPoints, resolveDailyTopScorers } = await import(
    "../notifications/dailyTopScorer.js"
  );
  const ymd = String(gameYmd || "").slice(0, 10);
  const { pointsByUid } = await computeDailyGroupPoints({ groupId, gameDateYmd: ymd });
  const resolved = resolveDailyTopScorers(pointsByUid);

  const patch = {
    topScore: resolved.topScore,
    winnerUids: resolved.winnerUids,
    fgcVoidCorrectionRefreshAt: FieldValue.serverTimestamp(),
  };

  const pushRef = db.doc(`groups/${groupId}/daily_top_scorer_pushes/${ymd}`);
  const awardRef = db.doc(`groups/${groupId}/daily_bonus_awards/${ymd}`);

  const [pushSnap, awardSnap] = await Promise.all([pushRef.get(), awardRef.get()]);
  if (pushSnap.exists) await pushRef.set(patch, { merge: true });
  if (awardSnap.exists) await awardRef.set(patch, { merge: true });

  return {
    topScore: resolved.topScore,
    winnerUids: resolved.winnerUids,
  };
}

export async function writeNhlFirstGoalNoWinner(fgRef, gameId, message = NO_WINNER_MESSAGE) {
  await fgRef.set(
    {
      gameId: String(gameId),
      status: "no_winner",
      confirmedAt: FieldValue.serverTimestamp(),
      result: {
        playerId: null,
        playerName: null,
        teamAbbr: null,
        timeInPeriod: null,
        period: null,
        goalId: null,
      },
      message,
      candidate: FieldValue.delete(),
      revealAt: FieldValue.delete(),
      finalReviewAt: FieldValue.delete(),
      provisionalAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function revertDecidedFgcChallengeToClosed(challengeId, { reason = "fgc-void" } = {}) {
  const chRef = db.doc(`first_goal_challenges/${challengeId}`);
  const chSnap = await chRef.get();
  if (!chSnap.exists) return { ok: false, reason: "missing-challenge" };

  const ch = chSnap.data() || {};
  const groupId = String(ch.groupId || "").trim();
  const gameYmd = String(ch.gameYmd || "").slice(0, 10);
  const winnersPreviewUids = Array.isArray(ch.winnersPreviewUids)
    ? ch.winnersPreviewUids.map(String)
    : [];

  const entriesSnap = await chRef.collection("entries").get();
  const reverted = [];

  for (const doc of entriesSnap.docs) {
    const entry = doc.data() || {};
    const uid = String(entry?.uid || doc.id);
    if (!isFgcEntryWinner({ ...entry, uid }, { winnersPreviewUids })) continue;

    const pts = storedFgcPoints(entry);
    if (pts > 0 && groupId) {
      const lb = await decrementLeaderboardFgcWin({
        groupId,
        uid,
        gameYmd,
        points: pts,
        wins: 1,
      });
      reverted.push({ uid, points: pts, leaderboard: lb });
    } else {
      reverted.push({ uid, points: pts, leaderboard: { skipped: true } });
    }

    await doc.ref.set(
      {
        won: false,
        payout: 0,
        points: 0,
        fgcVoidedAt: FieldValue.serverTimestamp(),
        fgcVoidReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const previousFirstGoal = ch.firstGoal || null;
  const previousStatus = String(ch.status || "");

  await chRef.set(
    {
      status: "closed",
      closedAt: FieldValue.serverTimestamp(),
      firstGoal: {
        playerId: null,
        playerName: null,
        teamAbbr: null,
        goalTime: null,
        confirmedAt: FieldValue.serverTimestamp(),
      },
      winnersCount: 0,
      winnersPreviewUids: [],
      winnerShares: {},
      payoutTotal: 0,
      payoutApplied: false,
      payoutAppliedReason: reason,
      payoutRevertedAt: FieldValue.serverTimestamp(),
      resultMessage: NO_WINNER_MESSAGE,
      fgcVoidedAt: FieldValue.serverTimestamp(),
      fgcVoidReason: reason,
      fgcVoidPreviousStatus: previousStatus,
      fgcVoidPreviousFirstGoal: previousFirstGoal,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  let dailyRefresh = null;
  if (groupId && gameYmd) {
    try {
      dailyRefresh = await refreshDailyTopScoreDocs({ groupId, gameYmd });
    } catch (e) {
      logger.warn("[FG-M] daily top refresh after void failed", {
        challengeId,
        err: String(e?.message || e),
      });
    }
  }

  await db.doc(`groups/${groupId}`).set(
    {
      leaderboardSeasonDirty: true,
      leaderboardSeasonDirtyAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    challengeId,
    groupId,
    revertedCount: reverted.length,
    reverted,
    dailyRefresh,
  };
}

/**
 * Corrige un match NHL déjà terminal (confirmed) si le PBP ne contient plus de premier but valide.
 */
export async function repairNhlFirstGoalTerminalGame(gameId, opts = {}) {
  const gid = String(gameId || "").trim();
  if (!gid) return { ok: false, reason: "missing-gameId" };

  const {
    forceNoWinner = false,
    revertChallenges = true,
    reason = "terminal-repair",
    dryRun = false,
  } = opts;

  const fgRef = db.collection(FIRST_GOAL_GAMES_COL).doc(gid);
  const fgSnap = await fgRef.get();
  const fg = fgSnap.exists ? fgSnap.data() || {} : null;
  const status = String(fg?.status || "");

  const liveSnap = await db.collection("nhl_live_games").doc(gid).get();
  const live = liveSnap.exists ? liveSnap.data() : null;
  const final = looksFinal(live);

  let currentFirst = null;
  try {
    currentFirst = await computeFirstValidGoalFromGoals(db, gid);
  } catch (e) {
    return { ok: false, reason: "compute-failed", err: String(e?.message || e) };
  }

  const confirmedPlayerId = fg?.result?.playerId ? String(fg.result.playerId) : null;
  const needsNoWinner =
    forceNoWinner || (!currentFirst && (final || status === "confirmed"));

  const needsWinnerChange =
    currentFirst &&
    confirmedPlayerId &&
    String(currentFirst.scoringPlayerId) !== confirmedPlayerId;

  if (!needsNoWinner && !needsWinnerChange) {
    return {
      ok: true,
      skipped: true,
      gameId: gid,
      status,
      currentFirst,
      final,
    };
  }

  if (needsNoWinner) {
    if (!final && !forceNoWinner) {
      return { ok: false, reason: "not-final", gameId: gid, currentFirst };
    }

    if (!dryRun) {
      await writeNhlFirstGoalNoWinner(fgRef, gid);
    }
  } else if (needsWinnerChange) {
    if (dryRun) {
      return {
        ok: true,
        gameId: gid,
        repaired: true,
        dryRun: true,
        needsNoWinner: false,
        needsWinnerChange: true,
        currentFirst,
        final,
        challenges: [],
      };
    }
    await fgRef.set(
      {
        status: "confirmed",
        confirmedAt: FieldValue.serverTimestamp(),
        result: {
          playerId: currentFirst.scoringPlayerId || null,
          playerName: currentFirst.scoringPlayerName || null,
          teamAbbr: currentFirst.teamAbbr || null,
          timeInPeriod: currentFirst.timeInPeriod || null,
          period: currentFirst.period ?? null,
          goalId: currentFirst.goalId || null,
        },
        message: "Premier but confirmé (corrigé après révision NHL).",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const challengeResults = [];
  if (revertChallenges && needsNoWinner) {
    const chSnap = await db.collection("first_goal_challenges").where("gameId", "==", gid).get();

    for (const doc of chSnap.docs) {
      const st = String(doc.data()?.status || "");
      if (st === "decided") {
        if (dryRun) {
          challengeResults.push({
            ok: true,
            dryRun: true,
            challengeId: doc.id,
            action: "would-revert-decided",
          });
        } else {
          challengeResults.push(await revertDecidedFgcChallengeToClosed(doc.id, { reason }));
        }
      } else if (st !== "closed") {
        if (dryRun) {
          challengeResults.push({
            ok: true,
            dryRun: true,
            challengeId: doc.id,
            action: "would-close",
          });
          continue;
        }
        await doc.ref.set(
          {
            status: "closed",
            closedAt: FieldValue.serverTimestamp(),
            firstGoal: {
              playerId: null,
              playerName: null,
              teamAbbr: null,
              goalTime: null,
              confirmedAt: FieldValue.serverTimestamp(),
            },
            winnersCount: 0,
            winnersPreviewUids: [],
            resultMessage: NO_WINNER_MESSAGE,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        challengeResults.push({ ok: true, challengeId: doc.id, action: "closed-pending" });
      }
    }
  }

  logger.info("[FG-M] repairNhlFirstGoalTerminalGame", {
    gameId: gid,
    needsNoWinner,
    needsWinnerChange,
    challengeCount: challengeResults.length,
  });

  return {
    ok: true,
    gameId: gid,
    repaired: true,
    needsNoWinner,
    needsWinnerChange,
    currentFirst,
    final,
    challenges: challengeResults,
  };
}

export async function verifyTerminalNhlFirstGoalGames({ limit = 40 } = {}) {
  const snap = await db
    .collection(FIRST_GOAL_GAMES_COL)
    .where("status", "==", "confirmed")
    .limit(limit)
    .get();

  const results = [];
  for (const doc of snap.docs) {
    const gameId = String(doc.id);
    const res = await repairNhlFirstGoalTerminalGame(gameId, {
      revertChallenges: true,
      reason: "auto-terminal-verify",
    });
    if (!res.skipped) results.push(res);
  }
  return { checked: snap.size, repaired: results.length, results };
}
