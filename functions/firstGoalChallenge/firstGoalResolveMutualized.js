// functions/firstGoalChallenge/firstGoalResolveMutualized.js
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue, logger } from "../utils.js";

const REGION = "us-central1";

// 90s = révélation provisoire
const REVEAL_DELAY_SECONDS = 90;

// 5 min = revue finale (confirmation)
const FINAL_REVIEW_DELAY_SECONDS = 300;

// garde-fou si un pending traine trop longtemps
const PENDING_MAX_AGE_MINUTES = 60;

// collection mutualisée: 1 doc par match
const FIRST_GOAL_GAMES_COL = "nhl_first_goal_games";

/* ----------------------------- Helpers ----------------------------- */

function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// "10:34" -> 634
function timeInPeriodToSeconds(s) {
  if (!s || typeof s !== "string") return null;
  const [mmS, ssS] = s.split(":").map((x) => x.trim());
  const mm = toInt(mmS, null);
  const ss = toInt(ssS, null);
  if (mm == null || ss == null) return null;
  return mm * 60 + ss;
}

function isShootoutGoal(goal) {
  const pt = String(goal?.periodType || "").toUpperCase();
  return pt === "SO";
}

function isValidGoal(goal) {
  if (!goal) return false;
  if (isShootoutGoal(goal)) return false;
  if (!goal?.scoringPlayerId && !goal?.scoringPlayerName) return false;
  return true;
}

function looksFinal(live) {
  const a = String(live?.gameState || "").toUpperCase();
  const b = String(live?.gameStatus || "").toUpperCase();
  const c = String(live?.status || "").toUpperCase();
  return (
    a.includes("FINAL") ||
    b.includes("FINAL") ||
    c.includes("FINAL") ||
    a === "OFF" ||
    b === "OFF" ||
    c === "OFF"
  );
}

/**
 * ✅ +1 au jackpot/boni si aucun gagnant
 * - Idempotent via champ "jackpotBumpApplied" sur le challenge.
 * - Ecrit sur groups/{groupId}.fgcBonus (adapte si ton champ est ailleurs).
 */
async function bumpGroupJackpotIfNoWinnersTx({ tx, chRef, chData, groupId, reason }) {
  if (!groupId) return { did: false, reason: "missing-groupId" };

  // idempotence: déjà bump ?
  if (chData?.jackpotBumpApplied === true) return { did: false, reason: "already-applied" };

  const groupRef = db.doc(`groups/${String(groupId)}`);

  tx.set(
    groupRef,
    {
      fgcBonus: FieldValue.increment(1),
      fgcBonusUpdatedAt: FieldValue.serverTimestamp(),
      fgcBonusLastReason: reason || "no_winner",
    },
    { merge: true }
  );

  tx.set(
    chRef,
    {
      jackpotBumpApplied: true,
      jackpotBumpAppliedAt: FieldValue.serverTimestamp(),
      jackpotBumpReason: reason || "no_winner",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { did: true };
}

/**
 * Calcule le premier but "valide" à partir de la sous-collection goals.
 * Exclut shootout. Trie par période + timeInPeriod.
 */
async function computeFirstValidGoalFromGoals(gameId) {
  const goalsRef = db.collection("nhl_live_games").doc(String(gameId)).collection("goals");

  const snap = await goalsRef.get();
  if (snap.empty) return null;

  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(isValidGoal);

  if (!rows.length) return null;

  rows.sort((a, b) => {
    const pa = toInt(a.period, 99);
    const pb = toInt(b.period, 99);
    if (pa !== pb) return pa - pb;

    const sa = timeInPeriodToSeconds(a.timeInPeriod) ?? 999999;
    const sb = timeInPeriodToSeconds(b.timeInPeriod) ?? 999999;
    if (sa !== sb) return sa - sb;

    return String(a.id).localeCompare(String(b.id));
  });

  const first = rows[0];
  return {
    goalId: String(first.id),
    scoringPlayerId: first.scoringPlayerId ? String(first.scoringPlayerId) : null,
    scoringPlayerName: first.scoringPlayerName || null,
    teamAbbr: first.teamAbbr || null,
    period: toInt(first.period, null),
    timeInPeriod: first.timeInPeriod || null,
    periodType: first.periodType || null,
  };
}

async function computeWinners(challengeRef, winnerPlayerId) {
  const q = await challengeRef
    .collection("entries")
    .where("playerId", "==", String(winnerPlayerId))
    .get();

  const winnersCount = q.size;
  const preview = q.docs.slice(0, 10).map((d) => d.id); // uid = docId
  return { winnersCount, winnersPreviewUids: preview };
}

/* ------------------------------------------------------------------ */
/* 1) Candidate mutualisée: quand un goal est créé                     */
/* ------------------------------------------------------------------ */

export const onFirstGoalCandidateFromGoalCreated_mutualized = onDocumentCreated(
  {
    document: "nhl_live_games/{gameId}/goals/{goalId}",
    region: REGION,
  },
  async (event) => {
    const gameId = String(event.params.gameId || "");
    const goalId = String(event.params.goalId || "");
    const goal = event.data?.data?.() ? event.data.data() : null;

    if (!gameId || !goalId || !goal) return;
    if (isShootoutGoal(goal)) return;
    if (!goal.scoringPlayerId && !goal.scoringPlayerName) return;

    // Re-calcule le "premier but actuel" (anti ordre d’arrivée)
    let first;
    try {
      first = await computeFirstValidGoalFromGoals(gameId);
    } catch (e) {
      logger.warn("[FG-M] computeFirstValidGoalFromGoals failed", {
        gameId,
        goalId,
        err: String(e?.message || e),
      });
      return;
    }

    // On ne réagit que si le goal créé est bien le premier but (actuel)
    if (!first || String(first.goalId) !== String(goalId)) return;

    const now = new Date();
    const revealAt = new Date(now.getTime() + REVEAL_DELAY_SECONDS * 1000);
    const finalReviewAt = new Date(now.getTime() + FINAL_REVIEW_DELAY_SECONDS * 1000);

    const fgRef = db.collection(FIRST_GOAL_GAMES_COL).doc(String(gameId));

    // si déjà confirmé, on ne touche pas
    const existing = await fgRef.get();
    if (existing.exists) {
      const d = existing.data() || {};
      const st = String(d.status || "");
      if (st === "confirmed" || st === "no_winner") return;

      const existingGoalId = d?.candidate?.goalId;
      // si un autre candidate existe déjà, on laisse le scheduler trancher
      if (existingGoalId && String(existingGoalId) !== String(goalId)) return;
    }

    await fgRef.set(
      {
        gameId: String(gameId),
        status: "pending", // pending -> provisional -> confirmed
        revealAt: Timestamp.fromDate(revealAt),
        finalReviewAt: Timestamp.fromDate(finalReviewAt),
        candidate: {
          goalId: String(goalId),
          scoringPlayerId: first.scoringPlayerId || null,
          scoringPlayerName: first.scoringPlayerName || null,
          teamAbbr: first.teamAbbr || null,
          period: first.period ?? null,
          timeInPeriod: first.timeInPeriod || null,
          periodType: first.periodType || null,
          observedAt: FieldValue.serverTimestamp(),
          revealAfterSeconds: REVEAL_DELAY_SECONDS,
        },
        message: "Premier but détecté. Vérification en cours…",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("[FG-M] candidate written (mutualized)", {
      gameId,
      goalId,
      scoringPlayerId: first.scoringPlayerId,
      revealAt: revealAt.toISOString(),
      finalReviewAt: finalReviewAt.toISOString(),
    });
  }
);

/* ------------------------------------------------------------------ */
/* 2) Scheduler mutualisé: toutes les minutes                          */
/* ------------------------------------------------------------------ */

export const confirmPendingFirstGoalsGames_mutualized = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Toronto",
    region: REGION,
  },
  async () => {
    const now = new Date();

    // On ne scanne que la collection mutualisée (très petite)
    const snap = await db
      .collection(FIRST_GOAL_GAMES_COL)
      .where("status", "in", ["pending", "provisional"])
      .limit(200)
      .get();

    if (snap.empty) return;

    for (const doc of snap.docs) {
      const fgRef = doc.ref;
      const fg = doc.data() || {};

      const gameId = String(fg.gameId || doc.id || "");
      const candidate = fg.candidate || null;

      const revealAt = fg.revealAt?.toDate?.() || null;
      const finalReviewAt = fg.finalReviewAt?.toDate?.() || null;

if (!gameId) {
  await fgRef.set(
    {
      status: "none",
      candidate: FieldValue.delete(),
      revealAt: FieldValue.delete(),
      finalReviewAt: FieldValue.delete(),
      provisionalAt: FieldValue.delete(),
      confirmedAt: FieldValue.delete(),
      result: FieldValue.delete(),
      message: "État invalide. Reset.",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  continue;
}

  if (!candidate?.goalId) {
    let rebuiltFirst = null;

    try {
      rebuiltFirst = await computeFirstValidGoalFromGoals(gameId);
    } catch (e) {
      logger.warn("[FG-M] auto-rebuild candidate failed", {
        gameId,
        err: String(e?.message || e),
      });
    }

    if (!rebuiltFirst) {
      await fgRef.set(
        {
          status: "none",
          candidate: FieldValue.delete(),
          revealAt: FieldValue.delete(),
          finalReviewAt: FieldValue.delete(),
          provisionalAt: FieldValue.delete(),
          confirmedAt: FieldValue.delete(),
          result: FieldValue.delete(),
          message: "État invalide. Reset.",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      continue;
    }

    // ✅ réparation manuelle accélérée :
    // au prochain tick, le scheduler pourra aller rapidement vers provisional/confirmed
    const revealAt2 = new Date(now.getTime() - 5 * 1000);
    const finalReviewAt2 = new Date(now.getTime() - 5 * 1000);

    await fgRef.set(
      {
        status: "pending",
        revealAt: Timestamp.fromDate(revealAt2),
        finalReviewAt: Timestamp.fromDate(finalReviewAt2),
        candidate: {
          goalId: String(rebuiltFirst.goalId),
          scoringPlayerId: rebuiltFirst.scoringPlayerId || null,
          scoringPlayerName: rebuiltFirst.scoringPlayerName || null,
          teamAbbr: rebuiltFirst.teamAbbr || null,
          period: rebuiltFirst.period ?? null,
          timeInPeriod: rebuiltFirst.timeInPeriod || null,
          periodType: rebuiltFirst.periodType || null,
          observedAt: FieldValue.serverTimestamp(),
          revealAfterSeconds: REVEAL_DELAY_SECONDS,
        },
        provisionalAt: FieldValue.delete(),
        confirmedAt: FieldValue.delete(),
        result: FieldValue.delete(),
        message: "Candidat premier but reconstruit automatiquement.",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    continue;
  }

      // garde-fou âge max
      const observedAt = candidate.observedAt?.toDate?.() || null;
      if (observedAt) {
        const maxAgeMs = PENDING_MAX_AGE_MINUTES * 60 * 1000;
        if (now.getTime() - observedAt.getTime() > maxAgeMs) {
          await fgRef.set(
            {
              status: "none",
              candidate: FieldValue.delete(),
              revealAt: FieldValue.delete(),
              finalReviewAt: FieldValue.delete(),
              provisionalAt: FieldValue.delete(),
              message: "Pending trop vieux. Reset.",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          continue;
        }
      }

      // Phase A) Révélation provisoire (>= revealAt)
      if (revealAt && now >= revealAt && String(fg.status) === "pending") {
        // quick re-check
        let currentFirstQuick = null;
        try {
          currentFirstQuick = await computeFirstValidGoalFromGoals(gameId);
        } catch (e) {
          logger.warn("[FG-M] quick computeFirstValidGoal failed", {
            gameId,
            err: String(e?.message || e),
          });
        }

        const stillSame =
          currentFirstQuick && String(currentFirstQuick.goalId) === String(candidate.goalId);

        await fgRef.set(
          {
            status: "provisional",
            provisionalAt: FieldValue.serverTimestamp(),
            message: stillSame
              ? "Premier but détecté (provisoire). Sujet à changement par la NHL…"
              : "Premier but en révision (provisoire). Sujet à changement par la NHL…",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Phase B) Finalisation (>= finalReviewAt)
      if (!finalReviewAt || now < finalReviewAt) {
        continue;
      }

      // re-calc final
      let currentFirst = null;
      try {
        currentFirst = await computeFirstValidGoalFromGoals(gameId);
      } catch (e) {
        logger.warn("[FG-M] computeFirstValidGoalFromGoals failed (final)", {
          gameId,
          err: String(e?.message || e),
        });
        continue;
      }

      // Aucun but: si match final => no_winner, sinon reset en pending/none
      if (!currentFirst) {
        try {
          const liveSnap = await db.collection("nhl_live_games").doc(gameId).get();
          const live = liveSnap.exists ? liveSnap.data() : null;

          if (live && looksFinal(live)) {
            await fgRef.set(
              {
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
                message:
                  "Aucun but en temps réglementaire / prolongation. Aucun gagnant (shootout exclu).",
                candidate: FieldValue.delete(),
                revealAt: FieldValue.delete(),
                finalReviewAt: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } else {
            await fgRef.set(
              {
                status: "pending",
                message: "Le match continue. Re-check plus tard.",
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
        } catch {
          // ignore: retry next tick
        }
        continue;
      }

      // candidate toujours le même?
      const sameGoal = String(currentFirst.goalId) === String(candidate.goalId);
    
      if (!sameGoal) {
        // ✅ on relance vite avec le nouveau vrai premier but
        const revealAt2 = new Date(now.getTime() - 5 * 1000);
        const finalReviewAt2 = new Date(now.getTime() - 5 * 1000);

        await fgRef.set(
          {
            status: "pending",
            revealAt: Timestamp.fromDate(revealAt2),
            finalReviewAt: Timestamp.fromDate(finalReviewAt2),
            candidate: {
              goalId: String(currentFirst.goalId),
              scoringPlayerId: currentFirst.scoringPlayerId || null,
              scoringPlayerName: currentFirst.scoringPlayerName || null,
              teamAbbr: currentFirst.teamAbbr || null,
              period: currentFirst.period ?? null,
              timeInPeriod: currentFirst.timeInPeriod || null,
              periodType: currentFirst.periodType || null,
              observedAt: FieldValue.serverTimestamp(),
              revealAfterSeconds: REVEAL_DELAY_SECONDS,
            },
            provisionalAt: FieldValue.delete(),
            confirmedAt: FieldValue.delete(),
            result: FieldValue.delete(),
            message: "Premier but ajusté par la ligue. Nouveau candidat détecté.",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        continue;
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
          message: "Premier but confirmé. Résultats disponibles.",
          candidate: FieldValue.delete(),
          revealAt: FieldValue.delete(),
          finalReviewAt: FieldValue.delete(),
          provisionalAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("[FG-M] confirmed (mutualized)", {
        gameId,
        winnerPlayerId: currentFirst.scoringPlayerId || null,
      });
    }
  }
);

/* ------------------------------------------------------------------ */
/* 3) Propagation vers challenges: quand result est confirmed/no_winner */
/*    + ✅ bump jackpot (+1) si winnersCount == 0 OU no_winner          */
/* ------------------------------------------------------------------ */

export const applyFirstGoalResultToChallenges_mutualized = onDocumentWritten(
  {
    document: `${FIRST_GOAL_GAMES_COL}/{gameId}`,
    region: REGION,
  },
  async (event) => {
    const gameId = String(event.params.gameId || "");
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const before = event.data?.before?.exists ? event.data.before.data() : null;

    if (!gameId || !after) return;

    const afterStatus = String(after.status || "");
    const beforeStatus = String(before?.status || "");

    // On agit seulement sur transition vers confirmed/no_winner
    const terminal = afterStatus === "confirmed" || afterStatus === "no_winner";
    if (!terminal) return;

    if (beforeStatus === afterStatus) return; // évite double-run

    const result = after.result || null;

    // Cherche challenges à résoudre
    const challengesSnap = await db
      .collection("first_goal_challenges")
      .where("gameId", "==", gameId)
      .where("status", "in", ["open", "locked", "pending"])
      .get();

    if (challengesSnap.empty) {
      logger.info("[FG-M] no challenges to apply", { gameId, afterStatus });
      return;
    }

    for (const doc of challengesSnap.docs) {
      const chRef = doc.ref;
      const ch = doc.data() || {};

      // déjà résolu ?
      if (
        ch?.firstGoal?.playerId ||
        String(ch.status) === "decided" ||
        String(ch.status) === "closed"
      ) {
        continue;
      }

      // ✅ no_winner => close + bump +1
      if (afterStatus === "no_winner") {
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(chRef);
          if (!fresh.exists) return;

          const ch2 = fresh.data() || {};
          const groupId = ch2.groupId;

          // 1) close (idempotent via merge)
          tx.set(
            chRef,
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
              resultMessage:
                "Aucun but en temps réglementaire / prolongation. Aucun gagnant (shootout exclu).",
              firstGoalCandidate: FieldValue.delete(),
              revealAt: FieldValue.delete(),
              finalReviewAt: FieldValue.delete(),
              provisionalRevealed: FieldValue.delete(),
              provisionalAt: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          // 2) bump +1 (idempotent)
          await bumpGroupJackpotIfNoWinnersTx({
            tx,
            chRef,
            chData: ch2,
            groupId,
            reason: "no_winner_game",
          });
        });

        continue;
      }

      // ✅ confirmed
      const winnerPlayerId = result?.playerId ? String(result.playerId) : null;

      let winnersCount = 0;
      let winnersPreviewUids = [];

      if (winnerPlayerId) {
        const w = await computeWinners(chRef, winnerPlayerId);
        winnersCount = w.winnersCount;
        winnersPreviewUids = w.winnersPreviewUids;
      }

      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(chRef);
        if (!fresh.exists) return;

        const ch2 = fresh.data() || {};
        const groupId = ch2.groupId;

        // 1) decided
        tx.set(
          chRef,
          {
            status: "decided",
            decidedAt: FieldValue.serverTimestamp(),
            firstGoal: {
              playerId: winnerPlayerId || null,
              playerName: result?.playerName || null,
              teamAbbr: result?.teamAbbr || null,
              goalTime: result?.timeInPeriod || null,
              confirmedAt: FieldValue.serverTimestamp(),
            },
            winnersCount,
            winnersPreviewUids,
            resultMessage: "Premier but confirmé. Résultats disponibles.",
            firstGoalCandidate: FieldValue.delete(),
            revealAt: FieldValue.delete(),
            finalReviewAt: FieldValue.delete(),
            provisionalRevealed: FieldValue.delete(),
            provisionalAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 2) si personne n'a trouvé => bump +1 (idempotent)
        if (Number(winnersCount || 0) === 0) {
          await bumpGroupJackpotIfNoWinnersTx({
            tx,
            chRef,
            chData: ch2,
            groupId,
            reason: "no_entries_matched",
          });
        }
      });
    }

    logger.info("[FG-M] applied to challenges (+jackpot bump if needed)", {
      gameId,
      afterStatus,
      count: challengesSnap.size,
    });
  }
);