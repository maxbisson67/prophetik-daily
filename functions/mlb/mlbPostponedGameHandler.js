/**
 * Match MLB reporté (Postponed) — règles produit :
 * - FGC : si premier RBI déjà confirmé → conserver le résultat et payer les bons pronostics ;
 *         sinon → annuler (personne n'a la bonne réponse).
 * - TP : slot voided, pas d'enjeu.
 * - TS : conserver les points déjà obtenus (pas de retrait de joueur).
 *
 * Distinct du retard (Delayed) : tant que le match n'est pas Postponed, rien ne change.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { isMlbGamePostponed } from "./mlbGameStatus.js";
import { computeBundleStatus } from "../teamPredictionBundles/tpBundleUtils.js";
import { applyFirstRbiResultToChallengesCore } from "../firstGoalChallenge/firstRbiResolveMutualized.js";

const FIRST_RBI_GAMES_COL = "mlb_first_rbi_games";
const FGC_TERMINAL_STATUSES = new Set(["decided", "closed"]);

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

export function buildVoidedTpSlotFields() {
  const now = Timestamp.now();
  return {
    status: "voided",
    voidReason: "GAME_POSTPONED",
    voidedAt: now,
    payoutApplied: true,
    payoutAppliedAt: now,
    payoutAppliedReason: "game-postponed",
    officialResult: {
      winnerAbbr: null,
      awayScore: null,
      homeScore: null,
      outcome: "VOID",
      confirmedAt: now,
    },
  };
}

export function isMlbGameChallengesVoided(doc = {}) {
  return !!doc?.challengesVoidedAt;
}

async function listFgcChallengesForGame(db, gamePk) {
  const pk = String(gamePk || "").trim();
  if (!pk) return [];

  const [byGameId, byGamePk] = await Promise.all([
    db.collection("first_goal_challenges").where("gameId", "==", pk).get(),
    db.collection("first_goal_challenges").where("gamePk", "==", pk).get(),
  ]);

  const seen = new Set();
  const docs = [];

  for (const doc of [...byGameId.docs, ...byGamePk.docs]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    docs.push(doc);
  }

  return docs;
}

async function cancelFgcChallenge(docRef, data = {}) {
  const st = String(data?.status || "").toLowerCase();
  if (st === "cancelled" && data?.cancelReason === "GAME_POSTPONED") {
    return false;
  }

  await docRef.set(
    {
      status: "cancelled",
      cancelReason: "GAME_POSTPONED",
      cancelledAt: FieldValue.serverTimestamp(),
      resultMessage: "Match reporté avant attribution du premier RBI — aucun gagnant.",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

async function resolveFgcOnPostpone(db, gamePk) {
  const pk = String(gamePk || "").trim();
  if (!pk) return { mode: "none", cancelled: 0, preserved: 0, applied: 0 };

  const rbiSnap = await db.doc(`${FIRST_RBI_GAMES_COL}/${pk}`).get();
  const rbi = rbiSnap.exists ? rbiSnap.data() || {} : {};
  const rbiStatus = String(rbi.status || "").toLowerCase();
  const winnerPlayerId = String(rbi.result?.playerId || "").trim();
  const hasConfirmedWinner = rbiStatus === "confirmed" && !!winnerPlayerId;

  const challengeDocs = await listFgcChallengesForGame(db, pk);
  let cancelled = 0;
  let preserved = 0;

  if (hasConfirmedWinner) {
    await db.doc(`${FIRST_RBI_GAMES_COL}/${pk}`).set(
      {
        postponedFrozenAt: FieldValue.serverTimestamp(),
        message: "Match reporté — résultat FGC confirmé avant le report.",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const applyRes = await applyFirstRbiResultToChallengesCore({
      gamePk: pk,
      afterStatus: "confirmed",
      beforeStatus: "",
      result: rbi.result,
      force: true,
    });

    for (const doc of challengeDocs) {
      const st = String(doc.data()?.status || "").toLowerCase();
      if (FGC_TERMINAL_STATUSES.has(st)) {
        preserved += 1;
      }
    }

    return {
      mode: "preserve-winner",
      cancelled: 0,
      preserved,
      applied: applyRes?.applied ?? 0,
      winnerPlayerId,
    };
  }

  if (rbiSnap.exists) {
    await db.doc(`${FIRST_RBI_GAMES_COL}/${pk}`).set(
      {
        status: "voided",
        voidReason: "GAME_POSTPONED",
        voidedAt: FieldValue.serverTimestamp(),
        message: "Match reporté — premier RBI non attribué.",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  for (const doc of challengeDocs) {
    if (await cancelFgcChallenge(doc.ref, doc.data())) {
      cancelled += 1;
    }
  }

  return { mode: "cancel-all", cancelled, preserved: 0, applied: 0 };
}

async function voidTpBundleSlotsForGame(db, gamePk, ymd) {
  const pk = String(gamePk || "").trim();
  const gameYmd = ymdCompact(ymd);
  if (!pk || !gameYmd) return { bundles: 0, slots: 0 };

  const snap = await db
    .collection("team_prediction_bundles")
    .where("league", "==", "MLB")
    .where("gameYmd", "==", gameYmd)
    .get();

  let bundles = 0;
  let slots = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const games = Array.isArray(data.games) ? [...data.games] : [];
    let changed = false;

    const nextGames = games.map((slot) => {
      if (String(slot?.gameId || "") !== pk) return slot;
      if (String(slot?.status || "").toLowerCase() === "voided") return slot;

      changed = true;
      slots += 1;
      return { ...slot, ...buildVoidedTpSlotFields() };
    });

    if (!changed) continue;

    bundles += 1;
    await doc.ref.set(
      {
        games: nextGames,
        status: computeBundleStatus(nextGames),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return { bundles, slots };
}

/** TS : marque le match reporté sans retirer les points déjà comptés. */
async function noteTsPostponedGame(db, gamePk, ymd) {
  const pk = String(gamePk || "").trim();
  if (!pk || !ymd) return { defis: 0 };

  const defisSnap = await db.collection("defis").where("gameDate", "==", String(ymd)).get();
  let defis = 0;

  for (const defiDoc of defisSnap.docs) {
    const liveRef = defiDoc.ref.collection("live").doc("stats");
    const liveSnap = await liveRef.get();
    if (!liveSnap.exists) continue;

    const postponedGamePks = liveSnap.data()?.postponedGamePks || [];
    if (postponedGamePks.includes(pk)) continue;

    await liveRef.set(
      {
        postponedGamePks: FieldValue.arrayUnion(pk),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    defis += 1;
  }

  return { defis };
}

/**
 * Idempotent — ignoré si déjà traité sur mlb_live_games.
 */
export async function handleMlbGamePostponed({
  db,
  gamePk,
  ymd,
  source = "mlbLive",
  force = false,
}) {
  const pk = String(gamePk || "").trim();
  if (!pk) return { ok: false, reason: "missing-gamePk" };

  const liveRef = db.doc(`mlb_live_games/${pk}`);
  const liveSnap = await liveRef.get();
  const live = liveSnap.exists ? liveSnap.data() || {} : {};

  if (!force && isMlbGameChallengesVoided(live)) {
    return { ok: true, skipped: true, reason: "already-voided", gamePk: pk };
  }

  const fgc = await resolveFgcOnPostpone(db, pk);
  const tp = await voidTpBundleSlotsForGame(db, pk, ymd || live.ymd || live.date);
  const ts = await noteTsPostponedGame(db, pk, ymd || live.ymd || live.date);

  await liveRef.set(
    {
      isPostponed: true,
      challengesVoidedAt: FieldValue.serverTimestamp(),
      challengesVoidedSource: source,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("[mlbPostponed] handled", {
    gamePk: pk,
    ymd: ymd || live.ymd || live.date,
    source,
    fgc,
    tp,
    ts,
  });

  return { ok: true, gamePk: pk, fgc, tp, ts };
}

export function shouldVoidChallengesForStatus(status = {}, existingDoc = null) {
  if (!isMlbGamePostponed(status)) return false;
  if (existingDoc && isMlbGameChallengesVoided(existingDoc)) return false;
  return true;
}
