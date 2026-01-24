// functions/utils/pushUtils.js
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldPath, FieldValue } from "firebase-admin/firestore";
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
  // docId = groupId_uid => on peut extraire si jamais fields manquent
  if (m?.userId || m?.uid || m?.participantId) {
    return String(m.userId || m.uid || m.participantId).trim();
  }
  const s = String(docId || "").trim();
  const idx = s.indexOf("_");
  return idx > 0 ? s.slice(idx + 1) : s;
}

function isAi(m, uid) {
  if (String(uid || "").toLowerCase() === "ai") return true;
  if (String(m?.uid || "").toLowerCase() === "ai") return true;
  if (String(m?.type || "").toLowerCase() === "ai") return true;
  return false;
}

async function fetchMemberships(groupId, logTag) {
  // 1) Query normale sur le champ groupId
  const snap1 = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get()
    .catch((e) => {
      logger.warn(`[${logTag}] memberships where(groupId==) failed`, { error: e?.message || String(e) });
      return null;
    });

  if (snap1 && !snap1.empty) return snap1;

  // 2) Fallback: docId prefix groupId_
  const start = `${String(groupId)}_`;
  const end = `${String(groupId)}_\uf8ff`;

  const snap2 = await db
    .collection("group_memberships")
    .where(FieldPath.documentId(), ">=", start)
    .where(FieldPath.documentId(), "<=", end)
    .get();

  return snap2;
}

async function collectUidsForGroup({
  groupId,
  createdBy,
  includeCreator = true,
  includeAi = false,
  logTag = "sendPushToGroup",
}) {
  const uids = new Set();
  if (!groupId) return uids;

  const snap = await fetchMemberships(groupId, logTag);

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
    groupId,
    count: uids.size,
    uids: Array.from(uids).slice(0, 10),
  });

  return uids;
}

async function collectTokensForUids(uids, logTag) {
  const expoSet = new Set();
  const fcmSet = new Set();

  for (const uid of uids) {
    const pRef = db.collection("participants").doc(uid);
    const pSnap = await pRef.get();

    if (!pSnap.exists) continue;
    const p = pSnap.data() || {};

    // ✅ map fcmTokens
    if (p.fcmTokens && typeof p.fcmTokens === "object") {
      for (const token of Object.keys(p.fcmTokens)) {
        if (!token) continue;
        if (token.startsWith("ExponentPushToken[")) expoSet.add(token);
        else fcmSet.add(token);
      }
    }

    // ✅ subcollection fcm_tokens
    const sub = await pRef.collection("fcm_tokens").get();
    sub.forEach((tDoc) => {
      const tok = tDoc.data()?.token || tDoc.id;
      if (!tok) return;
      const isExpo = tok.startsWith("ExponentPushToken[") || tDoc.data()?.type === "expo";
      if (isExpo) expoSet.add(tok);
      else fcmSet.add(tok);
    });
  }

  const expoTokens = Array.from(expoSet).filter(Boolean);
  const fcmTokens = Array.from(fcmSet).filter(Boolean);

  logger.info(`[${logTag}] token counts`, { expo: expoTokens.length, fcm: fcmTokens.length });
  return { expoTokens, fcmTokens };
}

async function sendExpoPush(tokens, payload, channelId, logTag) {
  if (!tokens?.length) return { ok: true, sent: 0, results: [] };

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

  let sent = 0;
  const allResults = [];

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

    // json.data est un array aligné avec "messages"
    const results = Array.isArray(json?.data) ? json.data : [];

    // On injecte le token "to" dans chaque résultat pour pouvoir nettoyer
    const withTo = results.map((r, idx) => ({ ...(r || {}), to: tks[idx] }));

    logger.info(`[${logTag}] expo response`, {
      status: res.status,
      sample: withTo.slice(0, 3).map((x) => ({ status: x.status, to: x.to, message: x.message, details: x.details })),
    });

    if (!res.ok) throw new Error(`Expo push failed: ${res.status}`);

    allResults.push(...withTo);
    sent += tks.length;
  }

  return { ok: true, sent, results: allResults };
}

async function sendFcmPush(tokens, payload, channelId, logTag) {
  if (!tokens?.length) return { ok: true, success: 0, failure: 0 };

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

    logger.info(`[${logTag}] fcm batch`, {
      batchSize: tks.length,
      success: resp.successCount,
      failure: resp.failureCount,
    });
  }

  return { ok: true, success, failure };
}

function expoErrorToCategory(details) {
  const d = details || {};
  const err = String(d.error || d.message || "").toLowerCase();

  // Expo errors courants
  if (err.includes("devicenotregistered")) return "DEVICE_NOT_REGISTERED";
  if (err.includes("invalidcredentials")) return "INVALID_CREDENTIALS";
  if (err.includes("messagerateexceeded")) return "RATE_LIMIT";
  if (err.includes("message too big")) return "MESSAGE_TOO_BIG";
  if (err.includes("invalid")) return "INVALID";
  return "OTHER";
}

/**
 * Nettoie les tokens Expo invalides dans:
 * - participants/{uid}.fcmTokens.{token} (map)
 * - participants/{uid}/fcm_tokens/{token} (subcollection)
 *
 * @param {Object} args
 * @param {string[]} args.uids - uids ciblés (ex: recipients)
 * @param {Array<{to:string,status?:string,id?:string,details?:any,message?:string}>} args.expoResults - json.data returned by Expo
 * @param {string} args.logTag
 */
async function cleanupExpoTokens({ uids, expoResults, logTag = "sendPushToGroup" }) {
  if (!uids?.length || !expoResults?.length) return { removed: 0, reasons: {} };

  // Les erreurs qui méritent suppression
  const SHOULD_DELETE = new Set([
    "DEVICE_NOT_REGISTERED",
    "INVALID",
    // INVALID_CREDENTIALS => c’est souvent config serveur, pas token (ne delete pas par défaut)
  ]);

  const badTokens = [];
  const reasons = {};

  for (const r of expoResults) {
    // r: {status:"ok"|"error", id? , message?, details?, to?}
    if (!r) continue;
    if (String(r.status).toLowerCase() !== "error") continue;

    const tok = r.to;
    if (!tok) continue;

    const cat = expoErrorToCategory(r.details || { error: r.message });
    reasons[cat] = (reasons[cat] || 0) + 1;

    if (SHOULD_DELETE.has(cat)) badTokens.push(tok);
  }

  const uniqueBad = Array.from(new Set(badTokens)).filter(Boolean);
  if (!uniqueBad.length) return { removed: 0, reasons };

  logger.warn(`[${logTag}] cleanupExpoTokens: removing tokens`, {
    count: uniqueBad.length,
    sample: uniqueBad.slice(0, 3),
    reasons,
  });

  // ⚠️ Stratégie simple:
  // On tente de supprimer le token chez tous les uids recipients.
  // (Même si on ne sait pas exactement quel uid possède quel token.)
  // Pour ~3-20 recipients, c’est OK.
  let removed = 0;

  for (const uid of uids) {
    const pRef = db.collection("participants").doc(uid);

    for (const tok of uniqueBad) {
      // map delete
      await pRef.update({ [`fcmTokens.${tok}`]: FieldValue.delete() }).catch(() => {});
      // subcollection delete (si tu utilises docId=token)
      await pRef.collection("fcm_tokens").doc(tok).delete().catch(() => {});
      removed += 1;
    }
  }

  logger.info(`[${logTag}] cleanupExpoTokens: done`, {
    removedWrites: removed,
    badTokens: uniqueBad.length,
    recipients: uids.length,
  });

  return { removed, reasons };
}

export async function sendPushToGroup({
  groupId,
  createdBy,
  includeCreator = true,
  includeAi = false,
  title,
  body,
  data = {},
  channelId = "challenges_v2",
  logTag = "sendPushToGroup",
}) {
  const uids = await collectUidsForGroup({ groupId, createdBy, includeCreator, includeAi, logTag });

  if (!uids.size) {
    logger.info(`[${logTag}] no recipients`, { groupId });
    return { ok: true, reason: "NO_RECIPIENTS", recipients: 0, expo: 0, fcm: 0, expoSent: 0, fcmSuccess: 0, fcmFailure: 0 };
  }

  const { expoTokens, fcmTokens } = await collectTokensForUids(Array.from(uids), logTag);

  let expoSent = 0;
  let fcmSuccess = 0;
  let fcmFailure = 0;

  if (expoTokens.length) {
    const r = await sendExpoPush(expoTokens, { title, body, data }, channelId, logTag)
      .catch((e) => {
        logger.error(`[${logTag}] expo failed`, { error: e?.message || String(e) });
        return { ok: false, sent: 0 };
      });
    expoSent = r?.sent || 0;
  }

  if (fcmTokens.length) {
    const r = await sendFcmPush(fcmTokens, { title, body, data }, channelId, logTag)
      .catch((e) => {
        logger.error(`[${logTag}] fcm failed`, { error: e?.message || String(e) });
        return { ok: false, success: 0, failure: 0 };
      });
    fcmSuccess = r?.success || 0;
    fcmFailure = r?.failure || 0;
  }

  return {
    ok: true,
    recipients: uids.size,
    expo: expoTokens.length,
    fcm: fcmTokens.length,
    expoSent,
    fcmSuccess,
    fcmFailure,
  };
}