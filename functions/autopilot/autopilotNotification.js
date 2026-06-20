import * as logger from "firebase-functions/logger";
import { sendPushToGroup } from "../utils/pushUtils.js";

const FGC_LABEL_BY_SPORT = {
  MLB: "Premier point produit",
  NHL: "Premier but",
};

function challengeLabel(challenge, sport) {
  if (challenge.type === "fgc") {
    return FGC_LABEL_BY_SPORT[sport] || FGC_LABEL_BY_SPORT.NHL;
  }

  if (challenge.type === "tp") {
    const count = Number(challenge.gameCount || 0);
    return count > 1 ? `${count} matchs à prédire` : "Prédire l'issue des matchs";
  }

  if (challenge.label) return String(challenge.label);
  return null;
}

export function buildAutopilotNotificationPayload({ groupId, sport, createdChallenges, gameYmd }) {
  const items = Array.isArray(createdChallenges) ? createdChallenges.filter(Boolean) : [];
  if (!items.length) return null;

  const labels = items.map((c) => challengeLabel(c, sport)).filter(Boolean);
  const title = items.length === 1 ? "Nouveau défi disponible" : "Nouveaux défis disponibles";
  const summary = labels.length ? labels.join(" • ") : "De nouveaux défis";
  const body = `${summary} • Fais tes choix avant le début des matchs.`;

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
  }

  return { title, body, data };
}

export async function notifyGroupOfAutopilotChallenges({
  groupId,
  sport,
  createdChallenges,
  gameYmd,
}) {
  const payload = buildAutopilotNotificationPayload({
    groupId,
    sport,
    createdChallenges,
    gameYmd,
  });

  if (!payload) {
    return { ok: true, skipped: true, reason: "NO_CHALLENGES" };
  }

  try {
    const res = await sendPushToGroup({
      groupId: String(groupId),
      includeAi: false,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      channelId: "challenges_v2",
      logTag: "groupAutopilot",
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
