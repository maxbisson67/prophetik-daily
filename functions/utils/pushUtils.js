// functions/utils/pushUtils.js
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

if (!getApps().length) initializeApp();

const db = getFirestore();
const messaging = getMessaging();

function isActiveMember(m) {
  if (m?.status !== undefined) return String(m.status).toLowerCase() === "active";
  if (m?.active !== undefined) return !!m.active;
  return true;
}

function pickUid(docId, m) {
  const uid = m?.userId || m?.uid || m?.participantId;
  if (uid) return String(uid).trim();

  // fallback: docId = groupId_uid
  const s = String(docId || "").trim();
  const idx = s.indexOf("_");
  return idx > 0 ? s.slice(idx + 1) : s;
}

function isAi(m, uid) {
  const u = String(uid || "").toLowerCase();
  if (u === "ai") return true;
  if (String(m?.uid || "").toLowerCase() === "ai") return true;
  if (String(m?.type || "").toLowerCase() === "ai") return true;
  return false;
}

async function fetchMemberships(groupId, logTag) {
  const gid = String(groupId);

  // 1) Query sur le champ groupId
  const snap1 = await db
    .collection("group_memberships")
    .where("groupId", "==", gid)
    .get()
    .catch((e) => {
      logger.warn(`[${logTag}] memberships where(groupId==) failed`, {
        error: e?.message || String(e),
      });
      return null;
    });

  if (snap1 && !snap1.empty) return snap1;

  // 2) Fallback: prefix sur docId (groupId_uid)
  const start = `${gid}_`;
  const end = `${gid}_\uf8ff`;

  const snap2 = await db
    .collection("group_memberships")
    .where(FieldPath.documentId(), ">=", start)
    .where(FieldPath.documentId(), "<=", end)
    .get();

  return snap2;
}

async function collectUidsForGroup({ groupId, createdBy, includeCreator, includeAi, logTag }) {
  const uids = new Set();
  if (!groupId) return uids;

  const snap = await fetchMemberships(groupId, logTag);

  logger.info(`[${logTag}] memberships fetched`, {
    groupId: String(groupId),
    size: snap.size,
    sampleIds: snap.docs.slice(0, 5).map((d) => d.id),
  });

  snap.forEach((d) => {
    const m = d.data() || {};
    if (!isActiveMember(m)) return;

    const uid = pickUid(d.id, m);
    if (!uid) return;

    if (!includeAi && isAi(m, uid)) return;
    if (!includeCreator && createdBy && uid === createdBy) return;

    uids.add(uid);
  });

  if (includeCreator && createdBy) uids.add(createdBy);

  logger.info(`[${logTag}] recipients computed`, {
    groupId: String(groupId),
    count: uids.size,
    uids: Array.from(uids),
  });

  return uids;
}

async function collectTokensForUids(uids, logTag) {
  const expoSet = new Set();
  const fcmSet = new Set();

  for (const uid of uids) {
    const pSnap = await db.collection("participants").doc(uid).get();
    if (!pSnap.exists) continue;

    const p = pSnap.data() || {};

    // map fcmTokens
    if (p.fcmTokens && typeof p.fcmTokens === "object") {
      for (const token of Object.keys(p.fcmTokens)) {
        if (!token) continue;
        if (token.startsWith("ExponentPushToken[")) expoSet.add(token);
        else fcmSet.add(token);
      }
    }

    // subcollection fcm_tokens
    const sub = await db.collection("participants").doc(uid).collection("fcm_tokens").get();
    sub.forEach((tDoc) => {
      const tok = tDoc.data()?.token || tDoc.id;
      if (!tok) return;

      const isExpo = tok.startsWith("ExponentPushToken[") || tDoc.data()?.type === "expo";
      if (isExpo) expoSet.add(tok);
      else fcmSet.add(tok);
    });
  }

  const expoTokens = Array.from(expoSet);
  const fcmTokens = Array.from(fcmSet);

  logger.info(`[${logTag}] token counts`, { expo: expoTokens.length, fcm: fcmTokens.length });
  return { expoTokens, fcmTokens };
}

async function sendExpoPush(tokens, payload, channelId, logTag) {
  if (!tokens.length) return { ok: true, sent: 0 };

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

  let sent = 0;

  for (const tks of chunks) {
    const messages = tks.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: "default",
      channelId,
    }));

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });

    const json = await res.json().catch(() => ({}));

    logger.info(`[${logTag}] expo response`, {
      status: res.status,
      sample: Array.isArray(json?.data) ? json.data.slice(0, 3) : null,
    });

    if (!res.ok) throw new Error(`Expo push failed: ${res.status}`);
    sent += tks.length;
  }

  return { ok: true, sent };
}

async function sendFcmPush(tokens, payload, channelId, logTag) {
  if (!tokens.length) return { ok: true, success: 0, failure: 0 };

  const base = {
    notification: { title: payload.title, body: payload.body },
    data: payload.data || {},
    android: { priority: "high", notification: { channelId } },
    apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
  };

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  let success = 0;
  let failure = 0;

  for (const tks of chunks) {
    const resp = await messaging.sendEachForMulticast({ ...base, tokens: tks });
    success += resp.successCount;
    failure += resp.failureCount;

    logger.info(`[${logTag}] fcm batch`, { batchSize: tks.length, success: resp.successCount, failure: resp.failureCount });
  }

  return { ok: true, success, failure };
}

export async function sendPushToGroup({
  groupId,
  createdBy,
  includeCreator = false,
  includeAi = false,
  title,
  body,
  data = {},
  channelId = "challenges_v2",
  logTag = "sendPushToGroup",
}) {
  const uids = await collectUidsForGroup({
    groupId,
    createdBy,
    includeCreator,
    includeAi,
    logTag,
  });

  if (!uids.size) {
    logger.info(`[${logTag}] no recipients`, { groupId: String(groupId) });
    return { ok: true, reason: "NO_RECIPIENTS", recipients: 0, expoSent: 0, fcmSuccess: 0, fcmFailure: 0 };
  }

  const { expoTokens, fcmTokens } = await collectTokensForUids(Array.from(uids), logTag);

  let expoSent = 0;
  let fcmSuccess = 0;
  let fcmFailure = 0;

  if (expoTokens.length) {
    const r = await sendExpoPush(expoTokens, { title, body, data }, channelId, logTag);
    expoSent = r.sent || 0;
  }

  if (fcmTokens.length) {
    const r = await sendFcmPush(fcmTokens, { title, body, data }, channelId, logTag);
    fcmSuccess = r.success || 0;
    fcmFailure = r.failure || 0;
  }

  return { ok: true, recipients: uids.size, expoSent, fcmSuccess, fcmFailure };
}