// functions/firstGoalChallenge/firstRbiResolveMutualized.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue, logger } from "../utils.js";
import { FUNCTIONS_REGION } from "../regions.js";

const SCHEDULER_REGION = FUNCTIONS_REGION;
const REVEAL_DELAY_SECONDS = 90;
const FINAL_REVIEW_DELAY_SECONDS = 300;
const PENDING_MAX_AGE_MINUTES = 60;
const FIRST_RBI_GAMES_COL = "mlb_first_rbi_games";
const APPLY_CHALLENGE_STATUSES = ["open", "locked", "pending"];
const ACTIVE_CHALLENGE_STATUSES = ["open", "locked", "pending", "live"];

const MLB_LIVE_FEED_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(String(gamePk))}/feed/live`;

/* ----------------------------- Helpers ----------------------------- */

function toInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function str(v) {
  return String(v ?? "").trim();
}

function resolveFgcMode(ch) {
  if (ch?.fgcMode) return String(ch.fgcMode);
  if (String(ch?.league || "").toUpperCase() === "MLB") return "first_rbi";
  return "first_goal";
}

function isMlbFirstRbiChallenge(ch) {
  if (!ch || typeof ch !== "object") return false;
  if (String(ch?.league || "").toUpperCase() !== "MLB") return false;
  if (String(ch?.type || "first_goal") !== "first_goal") return false;
  return resolveFgcMode(ch) === "first_rbi";
}

function challengeGamePk(ch) {
  return str(ch?.gamePk || ch?.gameId);
}

function isMlbFinal(liveFeed) {
  const abs = String(liveFeed?.gameData?.status?.abstractGameState || "").toLowerCase();
  const detailed = String(liveFeed?.gameData?.status?.detailedState || "").toLowerCase();
  const coded = String(liveFeed?.gameData?.status?.statusCode || "").toLowerCase();
  const inningState = String(liveFeed?.liveData?.linescore?.currentInningState || "").toLowerCase();

  return (
    abs === "final" ||
    detailed.includes("final") ||
    coded === "f" ||
    inningState === "final"
  );
}

function teamAbbrFromNode(node) {
  return str(node?.abbreviation || node?.team?.abbreviation || "").toUpperCase() || null;
}

function getOffenseTeamAbbr({ play, liveFeed }) {
  const half = String(play?.about?.halfInning || "").toLowerCase();
  const away = teamAbbrFromNode(liveFeed?.gameData?.teams?.away);
  const home = teamAbbrFromNode(liveFeed?.gameData?.teams?.home);

  if (half === "top") return away;
  if (half === "bottom") return home;
  return null;
}

function getPlayId(play) {
  const events = Array.isArray(play?.playEvents) ? play.playEvents : [];
  for (const ev of events) {
    if (ev?.playId != null) return String(ev.playId);
  }

  const idx = play?.about?.atBatIndex;
  if (idx != null) return `atBat-${idx}`;
  return null;
}

function normalizeMlbRbiCandidate(play, liveFeed) {
  const rbi = toInt(play?.result?.rbi, 0);
  if (!play || rbi <= 0) return null;

  const playId = getPlayId(play);
  const batter = play?.matchup?.batter || {};
  const batterId = batter?.id != null ? String(batter.id) : "";
  if (!playId || !batterId) return null;

  return {
    playId,
    atBatIndex: toInt(play?.about?.atBatIndex, null),
    batterId,
    batterName: str(batter?.fullName || batter?.name) || null,
    teamAbbr: getOffenseTeamAbbr({ play, liveFeed }),
    inning: toInt(play?.about?.inning, null),
    halfInning: play?.about?.halfInning ? String(play.about.halfInning) : null,
    eventType: play?.result?.eventType ? String(play.result.eventType) : null,
    description: play?.result?.description ? String(play.result.description) : null,
    rbi,
  };
}

function extractFirstRbiFromAllPlays(allPlays, liveFeed) {
  const rows = Array.isArray(allPlays) ? allPlays : [];
  for (const play of rows) {
    const candidate = normalizeMlbRbiCandidate(play, liveFeed);
    if (candidate) return candidate;
  }
  return null;
}

function sameCandidate(a, b) {
  if (!a || !b) return false;
  if (a.playId && b.playId && String(a.playId) === String(b.playId)) return true;
  if (
    a.batterId &&
    b.batterId &&
    String(a.batterId) === String(b.batterId) &&
    a.atBatIndex != null &&
    b.atBatIndex != null &&
    Number(a.atBatIndex) === Number(b.atBatIndex)
  ) {
    return true;
  }
  return false;
}

async function fetchMlbLiveFeed(gamePk) {
  const url = MLB_LIVE_FEED_URL(gamePk);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });
  if (!res.ok) throw new Error(`MLB live feed failed ${res.status}`);
  return res.json();
}

async function queryMlbFirstRbiChallenges(gamePk) {
  const pk = str(gamePk);
  if (!pk) return [];

  const withFgcMode = await db
    .collection("first_goal_challenges")
    .where("league", "==", "MLB")
    .where("fgcMode", "==", "first_rbi")
    .where("gameId", "==", pk)
    .where("status", "in", APPLY_CHALLENGE_STATUSES)
    .get();

  if (!withFgcMode.empty) return withFgcMode.docs;

  const fallback = await db
    .collection("first_goal_challenges")
    .where("league", "==", "MLB")
    .where("gameId", "==", pk)
    .where("status", "in", APPLY_CHALLENGE_STATUSES)
    .get();

  return fallback.docs.filter((doc) => isMlbFirstRbiChallenge(doc.data()));
}

async function hasUndecidedMlbFirstRbiChallenges(gamePk) {
  const docs = await queryMlbFirstRbiChallenges(gamePk);
  return docs.some((doc) => {
    const status = String(doc.data()?.status || "").toLowerCase();
    return status !== "decided" && status !== "closed";
  });
}

export async function repairConfirmedMlbFirstRbiForGamePk(gamePk) {
  const pk = str(gamePk);
  if (!pk) return { ok: false, reason: "missing-gamePk" };

  const fgSnap = await db.collection(FIRST_RBI_GAMES_COL).doc(pk).get();
  if (!fgSnap.exists) {
    return { ok: false, reason: "missing-game-doc", gamePk: pk };
  }

  const fg = fgSnap.data() || {};
  const afterStatus = String(fg.status || "");
  const terminal = afterStatus === "confirmed" || afterStatus === "no_winner";
  if (!terminal) {
    return { ok: false, reason: "not-terminal", gamePk: pk, status: afterStatus };
  }

  return applyFirstRbiResultToChallengesCore({
    gamePk: pk,
    afterStatus,
    beforeStatus: "",
    result: fg.result || null,
    force: true,
  });
}

async function computeWinners(challengeRef, winnerPlayerId) {
  const q = await challengeRef
    .collection("entries")
    .where("playerId", "==", String(winnerPlayerId))
    .get();

  return {
    winnersCount: q.size,
    winnersPreviewUids: q.docs.slice(0, 10).map((d) => d.id),
  };
}

function buildRevealTimestamps(now = new Date()) {
  return {
    revealAt: Timestamp.fromDate(new Date(now.getTime() + REVEAL_DELAY_SECONDS * 1000)),
    finalReviewAt: Timestamp.fromDate(
      new Date(now.getTime() + FINAL_REVIEW_DELAY_SECONDS * 1000)
    ),
  };
}

async function writePendingCandidate(fgRef, gamePk, candidate, now = new Date()) {
  const { revealAt, finalReviewAt } = buildRevealTimestamps(now);

  await fgRef.set(
    {
      gamePk: String(gamePk),
      gameId: String(gamePk),
      status: "pending",
      revealAt,
      finalReviewAt,
      candidate: {
        ...candidate,
        observedAt: FieldValue.serverTimestamp(),
        revealAfterSeconds: REVEAL_DELAY_SECONDS,
      },
      provisionalAt: FieldValue.delete(),
      confirmedAt: FieldValue.delete(),
      result: FieldValue.delete(),
      message: "Premier point produit détecté. Vérification en cours…",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function writeNoWinner(fgRef, gamePk) {
  await fgRef.set(
    {
      gamePk: String(gamePk),
      gameId: String(gamePk),
      status: "no_winner",
      confirmedAt: FieldValue.serverTimestamp(),
      result: {
        playerId: null,
        playerName: null,
        teamAbbr: null,
        inning: null,
        halfInning: null,
        eventType: null,
        playId: null,
      },
      message: "Aucun point produit confirmé. Aucun gagnant.",
      candidate: FieldValue.delete(),
      revealAt: FieldValue.delete(),
      finalReviewAt: FieldValue.delete(),
      provisionalAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function runMlbFirstRbiDetectForGamePk(gamePk) {
  const pk = str(gamePk);
  if (!pk) return { ok: false, reason: "missing-gamePk" };

  const fgRef = db.collection(FIRST_RBI_GAMES_COL).doc(String(pk));

  const existingSnap = await fgRef.get();
  const existing = existingSnap.exists ? existingSnap.data() || {} : null;
  const existingStatus = String(existing?.status || "");

  if (existingStatus === "confirmed" || existingStatus === "no_winner") {
    const applyRes = await repairConfirmedMlbFirstRbiForGamePk(pk);
    return {
      ok: true,
      skipped: true,
      reason: "terminal",
      gamePk: pk,
      status: existingStatus,
      apply: applyRes,
    };
  }

  const liveFeed = await fetchMlbLiveFeed(pk);
  const allPlays = liveFeed?.liveData?.plays?.allPlays || [];
  const firstRbi = extractFirstRbiFromAllPlays(allPlays, liveFeed);

  if (!firstRbi) {
    if (isMlbFinal(liveFeed)) {
      const beforeStatus = existingStatus || "";
      await writeNoWinner(fgRef, pk);
      await applyFirstRbiResultToChallengesCore({
        gamePk: pk,
        afterStatus: "no_winner",
        beforeStatus,
        result: {
          playerId: null,
          playerName: null,
          teamAbbr: null,
          inning: null,
          halfInning: null,
          eventType: null,
          playId: null,
        },
      });
      return { ok: true, gamePk: pk, status: "no_winner", collection: FIRST_RBI_GAMES_COL };
    }
    return {
      ok: true,
      skipped: true,
      reason: "no-rbi-yet",
      gamePk: pk,
      playsCount: allPlays.length,
      collection: FIRST_RBI_GAMES_COL,
    };
  }

  const existingCandidate = existing?.candidate || null;
  if (existingCandidate && sameCandidate(existingCandidate, firstRbi)) {
    return {
      ok: true,
      skipped: true,
      reason: "same-candidate",
      gamePk: pk,
      playId: firstRbi.playId,
      collection: FIRST_RBI_GAMES_COL,
    };
  }

  await writePendingCandidate(fgRef, pk, firstRbi);
  logger.info("[FGC-MLB] candidate written", {
    gamePk: pk,
    playId: firstRbi.playId,
    batterId: firstRbi.batterId,
    collection: FIRST_RBI_GAMES_COL,
  });

  return {
    ok: true,
    gamePk: pk,
    status: "pending",
    playId: firstRbi.playId,
    batterId: firstRbi.batterId,
    batterName: firstRbi.batterName,
    collection: FIRST_RBI_GAMES_COL,
  };
}

/* ------------------------------------------------------------------ */
/* 1) Détection: challenges MLB actifs -> mlb_first_rbi_games        */
/* ------------------------------------------------------------------ */

export const detectMlbFirstRbiCandidates_mutualized = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Toronto",
    region: SCHEDULER_REGION,
  },
  async () => {
    logger.info("[FGC-MLB] detect tick");

    const snap = await db
      .collection("first_goal_challenges")
      .where("league", "==", "MLB")
      .where("type", "==", "first_goal")
      .where("status", "in", ACTIVE_CHALLENGE_STATUSES)
      .limit(200)
      .get();

    const activeChallenges = snap.docs.filter((doc) => isMlbFirstRbiChallenge(doc.data()));

    logger.info("[FGC-MLB] detect challenges", {
      rawCount: snap.size,
      activeCount: activeChallenges.length,
      gamePks: activeChallenges.map((doc) => ({
        challengeId: doc.id,
        gamePk: challengeGamePk(doc.data()),
        fgcMode: resolveFgcMode(doc.data()),
        status: doc.data()?.status,
      })),
    });

    if (!activeChallenges.length) return;

    const gamePks = new Set();
    for (const doc of activeChallenges) {
      const pk = challengeGamePk(doc.data());
      if (pk) gamePks.add(pk);
    }

    if (!gamePks.size) return;

    for (const gamePk of gamePks) {
      try {
        await runMlbFirstRbiDetectForGamePk(gamePk);
      } catch (e) {
        logger.warn("[FGC-MLB] detect failed", {
          gamePk,
          err: String(e?.message || e),
        });
      }
    }
  }
);

/* ------------------------------------------------------------------ */
/* 2) Confirmation: pending/provisional -> confirmed/no_winner         */
/* ------------------------------------------------------------------ */

export const confirmPendingMlbFirstRbiGames_mutualized = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Toronto",
    region: SCHEDULER_REGION,
  },
  async () => {
    const now = new Date();

    const snap = await db
      .collection(FIRST_RBI_GAMES_COL)
      .where("status", "in", ["pending", "provisional"])
      .limit(200)
      .get();

    if (snap.empty) return;

    for (const doc of snap.docs) {
      const fgRef = doc.ref;
      const fg = doc.data() || {};
      const gamePk = str(fg.gamePk || fg.gameId || doc.id);
      const candidate = fg.candidate || null;
      const revealAt = fg.revealAt?.toDate?.() || null;
      const finalReviewAt = fg.finalReviewAt?.toDate?.() || null;

      if (!gamePk) continue;

      if (!candidate?.playId) {
        await fgRef.set(
          {
            status: "none",
            candidate: FieldValue.delete(),
            revealAt: FieldValue.delete(),
            finalReviewAt: FieldValue.delete(),
            message: "État invalide. Reset.",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

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

      let liveFeed = null;
      let currentFirst = null;

      const loadCurrentFirst = async () => {
        liveFeed = await fetchMlbLiveFeed(gamePk);
        const allPlays = liveFeed?.liveData?.plays?.allPlays || [];
        return extractFirstRbiFromAllPlays(allPlays, liveFeed);
      };

      // Phase A) Révélation provisoire
      if (revealAt && now >= revealAt && String(fg.status) === "pending") {
        try {
          currentFirst = await loadCurrentFirst();
        } catch (e) {
          logger.warn("[FGC-MLB] provisional fetch failed", {
            gamePk,
            err: String(e?.message || e),
          });
          continue;
        }

        const stillSame = currentFirst && sameCandidate(currentFirst, candidate);

        if (!stillSame && currentFirst) {
          await writePendingCandidate(fgRef, gamePk, currentFirst, now);
          continue;
        }

        await fgRef.set(
          {
            status: "provisional",
            provisionalAt: FieldValue.serverTimestamp(),
            message: stillSame
              ? "Premier point produit détecté (provisoire). Sujet à changement…"
              : "Premier point produit en révision (provisoire). Sujet à changement…",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (!finalReviewAt || now < finalReviewAt) {
        continue;
      }

      // Phase B) Finalisation
      try {
        currentFirst = await loadCurrentFirst();
      } catch (e) {
        logger.warn("[FGC-MLB] final fetch failed", {
          gamePk,
          err: String(e?.message || e),
        });
        continue;
      }

      if (!currentFirst) {
        if (liveFeed && isMlbFinal(liveFeed)) {
          const beforeStatus = String(fg.status || "");
          await writeNoWinner(fgRef, gamePk);
          await applyFirstRbiResultToChallengesCore({
            gamePk,
            afterStatus: "no_winner",
            beforeStatus,
            result: {
              playerId: null,
              playerName: null,
              teamAbbr: null,
              inning: null,
              halfInning: null,
              eventType: null,
              playId: null,
            },
          });
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
        continue;
      }

      if (!sameCandidate(currentFirst, candidate)) {
        const revealAt2 = new Date(now.getTime() - 5 * 1000);
        const finalReviewAt2 = new Date(now.getTime() - 5 * 1000);

        await fgRef.set(
          {
            status: "pending",
            revealAt: Timestamp.fromDate(revealAt2),
            finalReviewAt: Timestamp.fromDate(finalReviewAt2),
            candidate: {
              ...currentFirst,
              observedAt: FieldValue.serverTimestamp(),
              revealAfterSeconds: REVEAL_DELAY_SECONDS,
            },
            provisionalAt: FieldValue.delete(),
            confirmedAt: FieldValue.delete(),
            result: FieldValue.delete(),
            message: "Premier point produit ajusté. Nouveau candidat détecté.",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      const beforeStatus = String(fg.status || "");
      const confirmedResult = {
        playerId: currentFirst.batterId || null,
        playerName: currentFirst.batterName || null,
        teamAbbr: currentFirst.teamAbbr || null,
        inning: currentFirst.inning ?? null,
        halfInning: currentFirst.halfInning || null,
        eventType: currentFirst.eventType || null,
        playId: currentFirst.playId || null,
      };

      await fgRef.set(
        {
          status: "confirmed",
          confirmedAt: FieldValue.serverTimestamp(),
          result: confirmedResult,
          message: "Premier point produit confirmé. Résultats disponibles.",
          candidate: FieldValue.delete(),
          revealAt: FieldValue.delete(),
          finalReviewAt: FieldValue.delete(),
          provisionalAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await applyFirstRbiResultToChallengesCore({
        gamePk,
        afterStatus: "confirmed",
        beforeStatus,
        result: confirmedResult,
      });

      logger.info("[FGC-MLB] confirmed", {
        gamePk,
        winnerPlayerId: currentFirst.batterId || null,
      });
    }
  }
);

/* ------------------------------------------------------------------ */
/* 3) Propagation vers first_goal_challenges                           */
/* ------------------------------------------------------------------ */

export async function applyFirstRbiResultToChallengesCore({
  gamePk,
  afterStatus,
  beforeStatus = "",
  result = null,
  force = false,
}) {
  const pk = str(gamePk);
  if (!pk) return { ok: false, reason: "missing-gamePk" };

  logger.info("[RBI-M] apply trigger fired", {
    gamePk: pk,
    afterStatus,
    beforeStatus,
    force,
  });

  const terminal = afterStatus === "confirmed" || afterStatus === "no_winner";
  if (!terminal) return { ok: false, reason: "not-terminal" };
  if (!force && beforeStatus === afterStatus) {
    return { ok: true, skipped: true, reason: "same-status" };
  }

  const challengeDocs = await queryMlbFirstRbiChallenges(pk);

  logger.info("[RBI-M] challenges found", {
    gamePk: pk,
    count: challengeDocs.length,
    challengeIds: challengeDocs.map((doc) => doc.id),
  });

  if (!challengeDocs.length) {
    logger.info("[FGC-MLB] no challenges to apply", {
      gamePk: pk,
      afterStatus,
    });
    return { ok: true, applied: 0 };
  }

  for (const doc of challengeDocs) {
    const chRef = doc.ref;
    const ch = doc.data() || {};

    if (String(ch.status) === "decided" || String(ch.status) === "closed") {
      continue;
    }

    if (afterStatus === "no_winner") {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(chRef);
        if (!fresh.exists) return;

        tx.set(
          chRef,
          {
            status: "closed",
            closedAt: FieldValue.serverTimestamp(),
            firstRbi: {
              playerId: null,
              playerName: null,
              teamAbbr: null,
              inning: null,
              halfInning: null,
              eventType: null,
              confirmedAt: FieldValue.serverTimestamp(),
            },
            winnersCount: 0,
            winnersPreviewUids: [],
            resultMessage: "Aucun point produit confirmé. Aucun gagnant.",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
      continue;
    }

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

      tx.set(
        chRef,
        {
          status: "decided",
          decidedAt: FieldValue.serverTimestamp(),
          firstRbi: {
            playerId: winnerPlayerId || null,
            playerName: result?.playerName || null,
            teamAbbr: result?.teamAbbr || null,
            inning: result?.inning ?? null,
            halfInning: result?.halfInning || null,
            eventType: result?.eventType || null,
            confirmedAt: FieldValue.serverTimestamp(),
          },
          winnersCount,
          winnersPreviewUids,
          resultMessage: "Premier point produit confirmé. Résultats disponibles.",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  logger.info("[FGC-MLB] applied to challenges", {
    gamePk: pk,
    afterStatus,
    count: challengeDocs.length,
  });

  return { ok: true, applied: challengeDocs.length };
}

const FIRESTORE_TRIGGER_REGION = "us-central1";

export const applyFirstRbiResultToChallenges_mutualized = onDocumentWritten(
  {
    document: `${FIRST_RBI_GAMES_COL}/{gamePk}`,
    region: FIRESTORE_TRIGGER_REGION,
  },
  async (event) => {
    const gamePk = String(event.params.gamePk || "");
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const before = event.data?.before?.exists ? event.data.before.data() : null;

    if (!gamePk || !after) return;

    const afterStatus = String(after.status || "");
    const beforeStatus = String(before?.status || "");

    logger.info("[RBI-M] apply trigger fired", { gamePk, afterStatus, beforeStatus });

    const terminal = afterStatus === "confirmed" || afterStatus === "no_winner";
    if (!terminal) return;

    await applyFirstRbiResultToChallengesCore({
      gamePk,
      afterStatus,
      beforeStatus,
      result: after.result || null,
    });
  }
);

// Propagation: confirmPendingMlbFirstRbiGames_mutualized + repairConfirmedMlbFirstRbiChallenges
// (trigger Firestore applyFirstRbiResultToChallenges_mutualized non déployé sur capitaine)

export const repairConfirmedMlbFirstRbiChallenges = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Toronto",
    region: SCHEDULER_REGION,
  },
  async () => {
    const snap = await db
      .collection(FIRST_RBI_GAMES_COL)
      .where("status", "in", ["confirmed", "no_winner"])
      .limit(200)
      .get();

    if (snap.empty) return;

    for (const doc of snap.docs) {
      const gamePk = str(doc.id);
      const fg = doc.data() || {};
      const afterStatus = String(fg.status || "");

      try {
        const needsApply = await hasUndecidedMlbFirstRbiChallenges(gamePk);
        if (!needsApply) continue;

        logger.info("[RBI-M] repair confirmed game", { gamePk, afterStatus });

        await applyFirstRbiResultToChallengesCore({
          gamePk,
          afterStatus,
          beforeStatus: "",
          result: fg.result || null,
          force: true,
        });
      } catch (e) {
        logger.warn("[RBI-M] repair confirmed failed", {
          gamePk,
          err: String(e?.message || e),
        });
      }
    }
  }
);

export const repairMlbFirstRbiGameCallable = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  const gamePk = str(request.data?.gamePk || request.data?.gameId);
  if (!gamePk) {
    throw new HttpsError("invalid-argument", "gamePk manquant");
  }

  try {
    const detectRes = await runMlbFirstRbiDetectForGamePk(gamePk);
    let applyRes = detectRes?.apply || null;

    if (!applyRes && (detectRes?.reason === "terminal" || detectRes?.status === "confirmed" || detectRes?.status === "no_winner")) {
      applyRes = await repairConfirmedMlbFirstRbiForGamePk(gamePk);
    }

    const res = { ...detectRes, apply: applyRes };
    logger.info("[FGC-MLB] repair callable", { gamePk, res });
    return res;
  } catch (e) {
    logger.error("[FGC-MLB] repair callable failed", {
      gamePk,
      err: String(e?.message || e),
    });
    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", e?.message || "Erreur interne");
  }
});
