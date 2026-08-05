import * as logger from "firebase-functions/logger";
import { NOTIFICATION_PREF_KEYS } from "../notifications/notificationPrefs.js";
import { sendGroupPushByLang } from "../notifications/notificationUtils.js";

const CHALLENGE_TAG_BY_TYPE = {
  fgc: "SOLO",
  tp: "DUO",
  ts: "TRIO",
};

const CHALLENGE_TAG_ORDER = ["fgc", "tp", "ts"];

function resolveGroupLabel(groupName, sport) {
  const name = String(groupName || "").trim();
  const league = String(sport || "").trim().toUpperCase();
  if (name && league) return `${name} ${league}`;
  return name || league || "";
}

function challengeTags(createdChallenges = []) {
  const types = new Set(
    createdChallenges.map((c) => String(c?.type || "").toLowerCase()).filter(Boolean)
  );

  return CHALLENGE_TAG_ORDER.filter((type) => types.has(type)).map(
    (type) => CHALLENGE_TAG_BY_TYPE[type]
  );
}

function formatTagList(items = [], lang = "fr") {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) {
    return lang === "en" ? `${list[0]} and ${list[1]}` : `${list[0]} et ${list[1]}`;
  }
  const head = list.slice(0, -1).join(", ");
  const last = list[list.length - 1];
  return lang === "en" ? `${head} and ${last}` : `${head} et ${last}`;
}

export function buildAutopilotNotificationMessage(lang = "fr", { groupLabel, tags, multiple }) {
  const lg = String(lang || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
  const tagList = formatTagList(tags, lg);

  if (lg === "en") {
    const titleBase = multiple ? "New challenges available" : "New challenge available";
    const title = groupLabel ? `${titleBase} for ${groupLabel}` : titleBase;
    const body =
      tags.length === 1
        ? `The ${tagList} challenge is now available!`
        : `The ${tagList} challenges are now available!`;
    return { title, body };
  }

  const titleBase = multiple ? "Nouveaux défis disponibles" : "Nouveau défi disponible";
  const title = groupLabel ? `${titleBase} pour ${groupLabel}` : titleBase;
  const body =
    tags.length === 1
      ? `Le défi ${tagList} est maintenant disponible!`
      : `Les défis ${tagList} sont maintenant disponibles!`;
  return { title, body };
}

export function buildAutopilotNotificationPayload({
  groupId,
  groupName,
  sport,
  createdChallenges,
  gameYmd,
}) {
  const items = Array.isArray(createdChallenges) ? createdChallenges.filter(Boolean) : [];
  if (!items.length) return null;

  const groupLabel = resolveGroupLabel(groupName, sport);
  const tags = challengeTags(items);
  const { title, body } = buildAutopilotNotificationMessage("fr", {
    groupLabel,
    tags,
    multiple: items.length > 1,
  });

  const data = {
    action: "OPEN_GROUP_HOME",
    groupId: String(groupId),
    autopilotDay: String(gameYmd || ""),
    challengesCreated: JSON.stringify(
      items.map((c) => ({
        type: c.type,
        id: c.challengeId || c.bundleId || c.id || null,
      }))
    ),
  };

  for (const challenge of items) {
    if (challenge.type === "fgc" && challenge.challengeId) {
      data.fgcChallengeId = String(challenge.challengeId);
    }
    if (challenge.type === "tp" && challenge.bundleId) {
      data.tpBundleId = String(challenge.bundleId);
    }
    if (challenge.type === "ts" && (challenge.defiId || challenge.id)) {
      data.tsDefiId = String(challenge.defiId || challenge.id);
    }
  }

  return { title, body, data };
}

export async function notifyGroupOfAutopilotChallenges({
  groupId,
  groupName,
  sport,
  createdChallenges,
  gameYmd,
}) {
  const payload = buildAutopilotNotificationPayload({
    groupId,
    groupName,
    sport,
    createdChallenges,
    gameYmd,
  });

  if (!payload) {
    return { ok: true, skipped: true, reason: "NO_CHALLENGES" };
  }

  try {
    const groupLabel = resolveGroupLabel(groupName, sport);
    const tags = challengeTags(createdChallenges);

    const res = await sendGroupPushByLang({
      groupId: String(groupId),
      buildMessage: (lang) =>
        buildAutopilotNotificationMessage(lang, {
          groupLabel,
          tags,
          multiple: createdChallenges.length > 1,
        }),
      data: payload.data,
      channelId: "challenges_v2",
      logTag: "groupAutopilot",
      notificationPrefKey: NOTIFICATION_PREF_KEYS.MORNING_CHALLENGES,
    });

    logger.info("[GROUP AUTOPILOT] push done", {
      groupId,
      sport,
      challengeTypes: createdChallenges.map((c) => c.type),
      ...res,
    });

    return res;
  } catch (e) {
    logger.warn("[GROUP AUTOPILOT] push failed", {
      groupId,
      sport,
      err: String(e?.message || e),
    });
    return { ok: false, error: String(e?.message || e) };
  }
}
