import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { buildFgcWinPush, buildTpExactScorePush, buildTsWinPush } from "./challengeWinMessages.js";
import { NOTIFICATION_PREF_KEYS } from "./notificationPrefs.js";
import {
  fetchGroupName,
  loadParticipantDisplayNames,
  sendGroupPushByLang,
} from "./notificationUtils.js";

const db = getFirestore();

const TS_TYPE = 3;

function normalizeGameDateYmd(defiData = {}) {
  return String(defiData.gameDate || defiData.gameYmd || "").slice(0, 10);
}

/** True if any TS defi for this group+day already received the group win push. */
export async function hasTsWinPushForGroupDay({ groupId, gameDateYmd, excludeDefiId = null }) {
  const gid = String(groupId || "").trim();
  const ymd = String(gameDateYmd || "").slice(0, 10);
  if (!gid || !ymd) return false;

  const snap = await db
    .collection("defis")
    .where("groupId", "==", gid)
    .where("gameDate", "==", ymd)
    .where("type", "==", TS_TYPE)
    .limit(25)
    .get();

  return snap.docs.some((doc) => {
    if (excludeDefiId && doc.id === excludeDefiId) return false;
    return !!doc.data()?.groupWinPushSentAt;
  });
}

/** Mark all TS defis for group+day so catchup/finalize won't re-notify. */
export async function markTsWinPushSentForGroupDay({
  groupId,
  gameDateYmd,
  primaryDefiId = null,
  winnerUids = [],
}) {
  const gid = String(groupId || "").trim();
  const ymd = String(gameDateYmd || "").slice(0, 10);
  if (!gid || !ymd) return { marked: 0 };

  const snap = await db
    .collection("defis")
    .where("groupId", "==", gid)
    .where("gameDate", "==", ymd)
    .where("type", "==", TS_TYPE)
    .get();

  if (snap.empty) return { marked: 0 };

  const ts = FieldValue.serverTimestamp();
  const uids = Array.from(new Set((winnerUids || []).map(String).filter(Boolean)));
  const batch = db.batch();
  let marked = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (data.groupWinPushSentAt) continue;

    batch.set(
      doc.ref,
      {
        groupWinPushSentAt: ts,
        ...(primaryDefiId ? { groupWinPushPrimaryDefiId: String(primaryDefiId) } : {}),
      },
      { merge: true }
    );
    marked += 1;

    if (doc.id === primaryDefiId && uids.length) {
      for (const uid of uids) {
        batch.set(
          db.doc(`defis/${doc.id}/participations/${uid}`),
          { winPushSentAt: ts },
          { merge: true }
        );
      }
    }
  }

  if (marked > 0) await batch.commit();
  return { marked };
}

export async function notifyFgcWinners({
  challengeId,
  groupId,
  league,
  winnerUids = [],
  playerName,
}) {
  const cid = String(challengeId || "").trim();
  const gid = String(groupId || "").trim();
  const uids = Array.from(new Set((winnerUids || []).map(String).filter(Boolean)));

  if (!cid || !gid || !uids.length) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  const challengeRef = db.doc(`first_goal_challenges/${cid}`);
  const challengeSnap = await challengeRef.get();
  if (!challengeSnap.exists) {
    return { ok: true, skipped: true, reason: "missing-challenge" };
  }

  const chData = challengeSnap.data() || {};
  if (chData.groupWinPushSentAt) {
    return { ok: true, skipped: true, reason: "already-sent" };
  }

  const resolvedPlayerName =
    String(playerName || "").trim() ||
    String(chData?.firstRbi?.batterName || chData?.firstRbi?.playerName || "").trim() ||
    String(chData?.firstGoal?.scoringPlayerName || chData?.firstGoal?.playerName || "").trim() ||
    null;

  const nameByUid = await loadParticipantDisplayNames(uids);
  const winnerNames = uids.map((uid) => nameByUid.get(uid) || uid);
  const groupName = await fetchGroupName(gid);

  const pushRes = await sendGroupPushByLang({
    groupId: gid,
    buildMessage: (lang) =>
      buildFgcWinPush({
        lang,
        league: league || chData.league || "NHL",
        groupName,
        winnerNames,
        playerName: resolvedPlayerName,
      }),
    data: {
      action: "OPEN_FGC_RESULTS",
      groupId: gid,
      openChallengeId: cid,
      kind: "fgc",
      challengeId: cid,
    },
    channelId: "challenges_v2",
    logTag: "fgcWinPush",
    notificationPrefKey: NOTIFICATION_PREF_KEYS.FGC_WIN,
  });

  if (pushRes?.sent > 0) {
    await challengeRef.set({ groupWinPushSentAt: FieldValue.serverTimestamp() }, { merge: true });

    await Promise.all(
      uids.map((uid) =>
        db
          .doc(`first_goal_challenges/${cid}/entries/${uid}`)
          .set({ winPushSentAt: FieldValue.serverTimestamp() }, { merge: true })
      )
    );
  }

  logger.info("[fgcWinPush] done", {
    challengeId: cid,
    groupId: gid,
    sent: pushRes?.sent || 0,
    recipients: pushRes?.recipients || 0,
  });

  return { ok: true, sent: pushRes?.sent || 0 };
}

export async function notifyTpExactScore({
  bundleId,
  groupId,
  gameId,
  winnerUids = [],
  league,
  winnerAbbr,
  awayAbbr,
  homeAbbr,
  awayScore,
  homeScore,
}) {
  const bid = String(bundleId || "").trim();
  const gid = String(groupId || "").trim();
  const gidGame = String(gameId || "").trim();
  const uids = Array.from(new Set((winnerUids || []).map(String).filter(Boolean)));

  if (!bid || !gid || !gidGame || !uids.length) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  const bundleRef = db.doc(`team_prediction_bundles/${bid}`);
  const bundleSnap = await bundleRef.get();
  if (!bundleSnap.exists) {
    return { ok: true, skipped: true, reason: "missing-bundle" };
  }

  const bundle = bundleSnap.data() || {};
  const games = Array.isArray(bundle.games) ? bundle.games : [];
  const slotIndex = games.findIndex((g) => String(g.gameId) === gidGame);
  if (slotIndex < 0) {
    return { ok: true, skipped: true, reason: "missing-slot" };
  }

  const slot = games[slotIndex] || {};
  if (slot.exactScoreGroupPushSentAt) {
    return { ok: true, skipped: true, reason: "already-sent" };
  }

  const official = slot.officialResult || {};
  const resolvedWinnerAbbr = winnerAbbr || official.winnerAbbr;
  const resolvedAwayAbbr = awayAbbr || slot.awayAbbr;
  const resolvedHomeAbbr = homeAbbr || slot.homeAbbr;
  const resolvedAwayScore = awayScore ?? official.awayScore;
  const resolvedHomeScore = homeScore ?? official.homeScore;
  const resolvedLeague = league || bundle.league || "NHL";

  const nameByUid = await loadParticipantDisplayNames(uids);
  const winnerNames = uids.map((uid) => nameByUid.get(uid) || uid);
  const groupName = await fetchGroupName(gid);

  const pushRes = await sendGroupPushByLang({
    groupId: gid,
    buildMessage: (lang) =>
      buildTpExactScorePush({
        lang,
        league: resolvedLeague,
        groupName,
        winnerNames,
        winnerAbbr: resolvedWinnerAbbr,
        awayAbbr: resolvedAwayAbbr,
        homeAbbr: resolvedHomeAbbr,
        awayScore: resolvedAwayScore,
        homeScore: resolvedHomeScore,
      }),
    data: {
      action: "OPEN_TP_RESULTS",
      groupId: gid,
      openChallengeId: bid,
      kind: "tp",
      bundleId: bid,
      gameId: gidGame,
    },
    channelId: "challenges_v2",
    logTag: "tpExactScorePush",
    notificationPrefKey: NOTIFICATION_PREF_KEYS.TP_EXACT_SCORE,
  });

  if (pushRes?.sent > 0) {
    const nextGames = [...games];
    nextGames[slotIndex] = {
      ...slot,
      exactScoreGroupPushSentAt: FieldValue.serverTimestamp(),
    };

    await bundleRef.set({ games: nextGames, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    await Promise.all(
      uids.map(async (uid) => {
        const entryRef = db.doc(`team_prediction_bundles/${bid}/entries/${uid}`);
        await entryRef.set(
          {
            [`pickResults.${gidGame}.exactScorePushSentAt`]: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      })
    );
  }

  logger.info("[tpExactScorePush] done", {
    bundleId: bid,
    gameId: gidGame,
    groupId: gid,
    winners: uids.length,
    sent: pushRes?.sent || 0,
  });

  return { ok: true, sent: pushRes?.sent || 0 };
}

export async function notifyTsWinners({
  defiId,
  groupId,
  winnerUids = [],
  seasonId = null,
}) {
  const did = String(defiId || "").trim();
  const gid = String(groupId || "").trim();
  const uids = Array.from(new Set((winnerUids || []).map(String).filter(Boolean)));

  if (!did || !gid || !uids.length) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  const defiRef = db.doc(`defis/${did}`);
  const defiSnap = await defiRef.get();
  if (!defiSnap.exists) {
    return { ok: true, skipped: true, reason: "missing-defi" };
  }

  const defiData = defiSnap.data() || {};
  if (defiData.groupWinPushSentAt) {
    return { ok: true, skipped: true, reason: "already-sent" };
  }

  const gameDateYmd = normalizeGameDateYmd(defiData);
  if (
    gameDateYmd &&
    (await hasTsWinPushForGroupDay({ groupId: gid, gameDateYmd, excludeDefiId: did }))
  ) {
    await defiRef.set(
      {
        groupWinPushSentAt: FieldValue.serverTimestamp(),
        groupWinPushSkippedReason: "group-day-already-sent",
      },
      { merge: true }
    );
    logger.info("[tsWinPush] skipped duplicate group-day", {
      defiId: did,
      groupId: gid,
      gameDate: gameDateYmd,
    });
    return { ok: true, skipped: true, reason: "group-day-already-sent" };
  }

  const nameByUid = await loadParticipantDisplayNames(uids);
  const winnerNames = uids.map((uid) => nameByUid.get(uid) || uid);
  const groupName = await fetchGroupName(gid);

  const potTotal = Number(defiData.pot ?? 0) || 0;
  const winnerShares = defiData.winnerShares || {};
  const shareAmounts = uids
    .map((uid) => Number(winnerShares[uid] ?? 0))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const sharePerWinner = shareAmounts.length ? Math.min(...shareAmounts) : null;
  const shareMax = shareAmounts.length ? Math.max(...shareAmounts) : null;
  const shareUniform =
    shareAmounts.length > 0 && shareAmounts.every((amount) => amount === shareAmounts[0]);

  const pushRes = await sendGroupPushByLang({
    groupId: gid,
    buildMessage: (lang) =>
      buildTsWinPush({
        lang,
        groupName,
        winnerNames,
        potTotal,
        sharePerWinner,
        shareMax,
        shareUniform,
      }),
    data: {
      action: "OPEN_DEFI_RESULTS",
      groupId: gid,
      defiId: did,
      kind: "ts",
    },
    channelId: "challenges_v2",
    logTag: "tsWinPush",
    notificationPrefKey: NOTIFICATION_PREF_KEYS.TS_WIN,
  });

  if (pushRes?.sent > 0) {
    await markTsWinPushSentForGroupDay({
      groupId: gid,
      gameDateYmd,
      primaryDefiId: did,
      winnerUids: uids,
    });
  }

  logger.info("[tsWinPush] done", {
    defiId: did,
    groupId: gid,
    gameDate: gameDateYmd || null,
    sent: pushRes?.sent || 0,
    recipients: pushRes?.recipients || 0,
  });

  return { ok: true, sent: pushRes?.sent || 0 };
}
