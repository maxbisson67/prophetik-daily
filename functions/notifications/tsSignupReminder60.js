/**
 * Rappel TRIO (3×3) : 60 min avant signupDeadline → membres du groupe non inscrits.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

import { APP_TZ, appYmd } from "../ProphetikDate.js";
import { sendPushToUsers } from "../utils/pushUtils.js";
import { NOTIFICATION_PREF_KEYS } from "./notificationPrefs.js";
import {
  buildMemberLangRows,
  fetchGroupName,
  groupUidsByLang,
  normalizeLang,
} from "./notificationUtils.js";
import { fetchActiveHumanMemberUids } from "../leaderboard/leaderboardRankUtils.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const TS_TYPE = 3;
const REMINDER_MS = 60 * 60 * 1000;
const SIGNUP_DEADLINE_FALLBACK_MINUTES = 15;

export function toDefiDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveDefiSignupDeadline(defi = {}) {
  const direct = toDefiDate(defi.signupDeadline);
  if (direct) return direct;

  const first = toDefiDate(defi.firstGameUTC);
  if (!first) return null;

  return new Date(first.getTime() - SIGNUP_DEADLINE_FALLBACK_MINUTES * 60 * 1000);
}

export function shouldSendTsSignupReminder60({ nowMs, deadlineMs, alreadySent }) {
  if (alreadySent) return false;
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return false;

  const notifyAt = deadlineMs - REMINDER_MS;
  if (nowMs >= deadlineMs) return false;
  // Premier tick cron horaire entre notifyAt et deadline (pas de plafond étroit).
  return nowMs >= notifyAt;
}

function buildReminderMessage(lang, { groupLabel }) {
  const lg = normalizeLang(lang);
  if (lg === "en") {
    const title = groupLabel ? `TRIO — ${groupLabel}` : "TRIO — 1 hour left";
    const body = groupLabel
      ? `You have 1 hour left to join today's Trio challenge in ${groupLabel}.`
      : "You have 1 hour left to join today's Trio challenge.";
    return { title, body };
  }

  const title = groupLabel ? `TRIO — ${groupLabel}` : "TRIO — 1 h restante";
  const body = groupLabel
    ? `Il te reste 1 h pour t'inscrire au Trio du jour (${groupLabel}).`
    : "Il te reste 1 h pour t'inscrire au Trio du jour.";
  return { title, body };
}

export function groupTsDayKey(groupId, gameYmd) {
  const gid = String(groupId || "").trim();
  const ymd = String(gameYmd || "").slice(0, 10);
  return gid && ymd ? `${gid}|${ymd}` : "";
}

function participationUid(partDoc) {
  const data = partDoc.data?.() || partDoc.data || {};
  const uid = String(data.uid || partDoc.id || "").trim();
  if (!uid || uid.toLowerCase() === "ai") return "";
  return uid;
}

/** Inscrits à n'importe quel TRIO du groupe pour cette date (évite les doublons de defis/jour). */
export async function fetchHumanJoinedUidsForGroupTsDay(groupId, gameYmd) {
  const gid = String(groupId || "").trim();
  const ymd = String(gameYmd || "").slice(0, 10);
  if (!gid || !ymd) return new Set();

  const defisSnap = await db
    .collection("defis")
    .where("groupId", "==", gid)
    .where("gameDate", "==", ymd)
    .where("type", "==", TS_TYPE)
    .get();

  const joined = new Set();
  await Promise.all(
    defisSnap.docs.map(async (defiDoc) => {
      const partsSnap = await defiDoc.ref.collection("participations").get();
      for (const partDoc of partsSnap.docs) {
        const uid = participationUid(partDoc);
        if (uid) joined.add(uid);
      }
    })
  );

  return joined;
}

async function markTsReminderSentForGroupDay(groupId, gameYmd, extra = {}) {
  const gid = String(groupId || "").trim();
  const ymd = String(gameYmd || "").slice(0, 10);
  if (!gid || !ymd) return;

  const defisSnap = await db
    .collection("defis")
    .where("groupId", "==", gid)
    .where("gameDate", "==", ymd)
    .where("type", "==", TS_TYPE)
    .get();

  const patch = {
    tsSignupReminder60SentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };

  await Promise.all(defisSnap.docs.map((d) => d.ref.set(patch, { merge: true })));
}

async function sendReminderPush({ uids, groupLabel, defiId, groupId, gameDate }) {
  if (!uids.length) return { sent: 0 };

  const data = {
    action: "OPEN_DEFI",
    defiId: String(defiId),
    groupId: String(groupId),
    tsDefiId: String(defiId),
    gameDate: String(gameDate || ""),
  };

  const langRows = await buildMemberLangRows(uids);
  let delivered = 0;

  for (const [lang, rows] of groupUidsByLang(langRows).entries()) {
    const batchUids = rows.map((r) => r.uid);
    const { title, body } = buildReminderMessage(lang, { groupLabel });

    const pushRes = await sendPushToUsers({
      uids: batchUids,
      title,
      body,
      data,
      channelId: "challenges_v2",
      logTag: "tsSignupReminder60",
      notificationPrefKey: NOTIFICATION_PREF_KEYS.TS_SIGNUP_REMINDER,
    });

    delivered += (Number(pushRes.expoSent) || 0) + (Number(pushRes.fcmSuccess) || 0);
  }

  return { sent: delivered, recipients: uids.length };
}

async function processOpenTsDefi(defiDoc, nowMs) {
  const defi = defiDoc.data() || {};
  const defiId = defiDoc.id;

  if (Number(defi.type) !== TS_TYPE) return { skipped: true, reason: "not-ts" };

  const status = String(defi.status || "").toLowerCase();
  if (status !== "open") return { skipped: true, reason: "not-open" };

  const groupId = String(defi.groupId || "").trim();
  const gameYmd = String(defi.gameDate || "").slice(0, 10);
  const dayKey = groupTsDayKey(groupId, gameYmd);

  if (defi.tsSignupReminder60SentAt) {
    return { skipped: true, reason: "already-sent" };
  }

  const deadline = resolveDefiSignupDeadline(defi);
  if (!deadline) return { skipped: true, reason: "no-deadline" };

  const deadlineMs = deadline.getTime();
  if (
    !shouldSendTsSignupReminder60({
      nowMs,
      deadlineMs,
      alreadySent: false,
    })
  ) {
    return { skipped: true, reason: "outside-window" };
  }

  if (!groupId) return { skipped: true, reason: "no-group" };

  const siblingSnap = await db
    .collection("defis")
    .where("groupId", "==", groupId)
    .where("gameDate", "==", gameYmd)
    .where("type", "==", TS_TYPE)
    .get();

  const dayAlreadySent = siblingSnap.docs.some((d) => d.data()?.tsSignupReminder60SentAt);
  if (dayAlreadySent) {
    return { skipped: true, reason: "already-sent-group-day", defiId, dayKey };
  }

  const memberUids = await fetchActiveHumanMemberUids(groupId);
  const joined = await fetchHumanJoinedUidsForGroupTsDay(groupId, gameYmd);
  const targetUids = memberUids.filter((uid) => !joined.has(String(uid)));

  if (!targetUids.length) {
    await markTsReminderSentForGroupDay(groupId, gameYmd, {
      tsSignupReminder60Skipped: "no-unjoined-members",
    });
    return { skipped: true, reason: "all-joined", defiId, joinedCount: joined.size };
  }

  const groupName = await fetchGroupName(groupId);
  const sport = String(defi.sport || "").trim().toUpperCase();
  const groupLabel = groupName && sport ? `${groupName} ${sport}` : groupName || "";

  const push = await sendReminderPush({
    uids: targetUids,
    groupLabel,
    defiId,
    groupId,
    gameDate: defi.gameDate,
  });

  await markTsReminderSentForGroupDay(groupId, gameYmd, {
    tsSignupReminder60RecipientCount: targetUids.length,
    tsSignupReminder60SourceDefiId: defiId,
  });

  logger.info("[tsSignupReminder60] sent", {
    defiId,
    groupId,
    dayKey,
    joinedCount: joined.size,
    tsDefiCount: siblingSnap.size,
    recipients: targetUids.length,
    ...push,
    deadline: deadline.toISOString(),
  });

  return { ok: true, defiId, ...push };
}

export async function runTsSignupReminder60Scan(now = new Date()) {
  const today = appYmd(now);
  const nowMs = now.getTime();

  const snap = await db
    .collection("defis")
    .where("gameDate", "==", today)
    .where("status", "==", "open")
    .where("type", "==", TS_TYPE)
    .get();

  const results = [];
  for (const doc of snap.docs) {
    try {
      results.push(await processOpenTsDefi(doc, nowMs));
    } catch (e) {
      logger.warn("[tsSignupReminder60] defi failed", {
        defiId: doc.id,
        err: String(e?.message || e),
      });
      results.push({ ok: false, defiId: doc.id, error: String(e?.message || e) });
    }
  }

  return { today, scanned: snap.size, results };
}

export const tsSignupReminder60 = onSchedule(
  {
    // :55 de 12h à 23h (Toronto) — peu de matchs NHL avant 13h.
    schedule: "55 12-23 * * *",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const summary = await runTsSignupReminder60Scan(new Date());
    logger.info("[tsSignupReminder60] tick", summary);
  }
);
