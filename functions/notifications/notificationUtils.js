import { getFirestore } from "firebase-admin/firestore";
import { resolveGroupDisplayName } from "../groups/groupDisplayUtils.js";
import { fetchActiveHumanMemberUids } from "../leaderboard/leaderboardRankUtils.js";
import { sendPushToUsers } from "../utils/pushUtils.js";

const db = getFirestore();

function countDeliveredPushes(pushRes = {}) {
  return (Number(pushRes.expoSent) || 0) + (Number(pushRes.fcmSuccess) || 0);
}

export function normalizeLang(lang) {
  return String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

export async function getParticipantLang(uid) {
  try {
    const snap = await db.doc(`participants/${uid}`).get();
    return normalizeLang(snap.data()?.appLang);
  } catch {
    return "fr";
  }
}

function pickDisplayName(data = {}, uid = "") {
  const name =
    String(data.displayName || data.name || data.firstName || "").trim() ||
    String(uid || "").slice(0, 8);
  return name || "Membre";
}

export async function loadParticipantDisplayNames(uids = []) {
  const unique = Array.from(new Set((uids || []).map(String).filter(Boolean)));
  const map = new Map();

  await Promise.all(
    unique.map(async (uid) => {
      if (String(uid).toLowerCase() === "ai") {
        map.set(uid, "Nova");
        return;
      }
      try {
        const snap = await db.doc(`participants/${uid}`).get();
        map.set(uid, pickDisplayName(snap.exists ? snap.data() : {}, uid));
      } catch {
        map.set(uid, pickDisplayName({}, uid));
      }
    })
  );

  return map;
}

export function formatNameList(names = [], lang = "fr") {
  const list = (names || []).map((n) => String(n || "").trim()).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) {
    return lang === "en" ? `${list[0]} and ${list[1]}` : `${list[0]} et ${list[1]}`;
  }
  const head = list.slice(0, -1).join(", ");
  const last = list[list.length - 1];
  return lang === "en" ? `${head} and ${last}` : `${head} et ${last}`;
}

export async function fetchGroupName(groupId) {
  try {
    const snap = await db.doc(`groups/${String(groupId || "").trim()}`).get();
    return resolveGroupDisplayName(snap.data() || {});
  } catch {
    return null;
  }
}

export function groupUidsByLang(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const lang = normalizeLang(row.lang);
    if (!map.has(lang)) map.set(lang, []);
    map.get(lang).push(row);
  }
  return map;
}

export async function buildMemberLangRows(memberUids = []) {
  const uids = Array.from(new Set((memberUids || []).map(String).filter(Boolean)));
  const rows = await Promise.all(
    uids.map(async (uid) => ({
      uid,
      lang: await getParticipantLang(uid),
    }))
  );
  return rows;
}

/**
 * Envoie une push groupée à tous les membres actifs (humains), par langue.
 */
export async function sendGroupPushByLang({
  groupId,
  buildMessage,
  data = {},
  channelId = "challenges_v2",
  logTag = "groupPush",
  notificationPrefKey = null,
}) {
  const gid = String(groupId || "").trim();
  if (!gid || typeof buildMessage !== "function") {
    return { ok: true, skipped: true, reason: "invalid-input", sent: 0 };
  }

  const memberUids = await fetchActiveHumanMemberUids(gid);
  if (!memberUids.length) {
    return { ok: true, skipped: true, reason: "no-members", sent: 0 };
  }

  const langRows = await buildMemberLangRows(memberUids);
  let delivered = 0;

  for (const [lang, rows] of groupUidsByLang(langRows).entries()) {
    const batchUids = rows.map((r) => r.uid);
    const { title, body } = buildMessage(lang);

    const pushRes = await sendPushToUsers({
      uids: batchUids,
      title,
      body,
      data,
      channelId,
      logTag,
      notificationPrefKey,
    });

    delivered += countDeliveredPushes(pushRes);
  }

  return { ok: true, sent: delivered, recipients: memberUids.length };
}
