import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { sendPushToUsers } from "../utils/pushUtils.js";
import { buildFgcWinPush, buildTpExactScorePush, buildTsWinPush } from "./challengeWinMessages.js";
import { NOTIFICATION_PREF_KEYS } from "./notificationPrefs.js";

const db = getFirestore();

function normalizeLang(lang) {
  return String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

async function getParticipantLang(uid) {
  try {
    const snap = await db.doc(`participants/${uid}`).get();
    return normalizeLang(snap.data()?.appLang);
  } catch {
    return "fr";
  }
}

function groupPendingByLang(pending) {
  const map = new Map();
  for (const row of pending) {
    const lang = normalizeLang(row.lang);
    if (!map.has(lang)) map.set(lang, []);
    map.get(lang).push(row);
  }
  return map;
}

export async function notifyFgcWinners({
  challengeId,
  groupId,
  league,
  winnerUids = [],
}) {
  const cid = String(challengeId || "").trim();
  const gid = String(groupId || "").trim();
  const uids = Array.from(new Set((winnerUids || []).map(String).filter(Boolean)));

  if (!cid || !gid || !uids.length) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  const pending = [];

  for (const uid of uids) {
    const entryRef = db.doc(`first_goal_challenges/${cid}/entries/${uid}`);
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) continue;
    if (entrySnap.data()?.winPushSentAt) continue;

    const lang = await getParticipantLang(uid);
    pending.push({ uid, lang, entryRef });
  }

  if (!pending.length) {
    return { ok: true, skipped: true, reason: "already-sent-or-missing" };
  }

  let sent = 0;

  for (const [lang, rows] of groupPendingByLang(pending).entries()) {
    const batchUids = rows.map((r) => r.uid);
    const { title, body } = buildFgcWinPush({ lang, league });

    const pushRes = await sendPushToUsers({
      uids: batchUids,
      title,
      body,
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

    if (pushRes?.recipients > 0) {
      await Promise.all(
        rows.map((row) =>
          row.entryRef.set({ winPushSentAt: FieldValue.serverTimestamp() }, { merge: true })
        )
      );
      sent += batchUids.length;
    }
  }

  logger.info("[fgcWinPush] done", { challengeId: cid, groupId: gid, sent });
  return { ok: true, sent };
}

export async function notifyTpExactScore({
  bundleId,
  groupId,
  gameId,
  uid,
  awayAbbr,
  homeAbbr,
  awayScore,
  homeScore,
}) {
  const bid = String(bundleId || "").trim();
  const gid = String(groupId || "").trim();
  const gidGame = String(gameId || "").trim();
  const userId = String(uid || "").trim();

  if (!bid || !gid || !gidGame || !userId) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  const entryRef = db.doc(`team_prediction_bundles/${bid}/entries/${userId}`);
  const entrySnap = await entryRef.get();
  if (!entrySnap.exists) {
    return { ok: true, skipped: true, reason: "missing-entry" };
  }

  const pickResult = entrySnap.data()?.pickResults?.[gidGame] || {};
  if (!pickResult.exactScoreCorrect) {
    return { ok: true, skipped: true, reason: "not-exact-score" };
  }
  if (pickResult.exactScorePushSentAt) {
    return { ok: true, skipped: true, reason: "already-sent" };
  }

  const lang = await getParticipantLang(userId);
  const { title, body } = buildTpExactScorePush({
    lang,
    awayAbbr,
    homeAbbr,
    awayScore,
    homeScore,
  });

  const pushRes = await sendPushToUsers({
    uids: [userId],
    title,
    body,
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

  if (pushRes?.recipients > 0) {
    await entryRef.set(
      {
        [`pickResults.${gidGame}.exactScorePushSentAt`]: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  logger.info("[tpExactScorePush] done", {
    bundleId: bid,
    gameId: gidGame,
    uid: userId,
    recipients: pushRes?.recipients || 0,
  });

  return { ok: true, sent: pushRes?.recipients > 0 ? 1 : 0 };
}

export async function notifyTsWinners({ defiId, groupId, winnerUids = [] }) {
  const did = String(defiId || "").trim();
  const gid = String(groupId || "").trim();
  const uids = Array.from(new Set((winnerUids || []).map(String).filter(Boolean))).filter(
    (uid) => uid.toLowerCase() !== "ai"
  );

  if (!did || !gid || !uids.length) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  const pending = [];

  for (const uid of uids) {
    const partRef = db.doc(`defis/${did}/participations/${uid}`);
    const partSnap = await partRef.get();
    if (!partSnap.exists) continue;
    if (partSnap.data()?.winPushSentAt) continue;

    const lang = await getParticipantLang(uid);
    pending.push({ uid, lang, partRef });
  }

  if (!pending.length) {
    return { ok: true, skipped: true, reason: "already-sent-or-missing" };
  }

  let sent = 0;

  for (const [lang, rows] of groupPendingByLang(pending).entries()) {
    const batchUids = rows.map((r) => r.uid);
    const { title, body } = buildTsWinPush({ lang });

    const pushRes = await sendPushToUsers({
      uids: batchUids,
      title,
      body,
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

    if (pushRes?.recipients > 0) {
      await Promise.all(
        rows.map((row) =>
          row.partRef.set({ winPushSentAt: FieldValue.serverTimestamp() }, { merge: true })
        )
      );
      sent += batchUids.length;
    }
  }

  logger.info("[tsWinPush] done", { defiId: did, groupId: gid, sent });
  return { ok: true, sent };
}
