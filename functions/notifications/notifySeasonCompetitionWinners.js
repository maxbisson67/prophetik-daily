import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { sendPushToUsers } from "../utils/pushUtils.js";
import { resolveGroupDisplayName } from "../groups/groupDisplayUtils.js";

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

function buildPush({ lang, groupName, competitionLabel, winnerPoints, isCoWinner }) {
  const group = String(groupName || "").trim();
  const label = String(competitionLabel || "").trim();

  if (lang === "en") {
    const title = group ? `Champion — ${group}` : "Season champion";
    const body = isCoWinner
      ? `You are co-champion of ${label || "the competition"} with ${winnerPoints} pts!`
      : `You won ${label || "the competition"} with ${winnerPoints} pts!`;
    return { title, body };
  }

  const title = group ? `Champion — ${group}` : "Champion de saison";
  const body = isCoWinner
    ? `Tu es co-champion de ${label || "la compétition"} avec ${winnerPoints} pts !`
    : `Tu remportes ${label || "la compétition"} avec ${winnerPoints} pts !`;

  return { title, body };
}

export async function notifySeasonCompetitionWinners({
  groupId,
  competition = {},
  winnerUids = [],
  winnerPoints = 0,
} = {}) {
  const gid = String(groupId || "").trim();
  const uids = Array.from(new Set((winnerUids || []).map(String).filter(Boolean)));
  const humanUids = uids.filter((uid) => uid.toLowerCase() !== "ai");

  if (!gid || !humanUids.length) {
    return { ok: true, skipped: true, reason: "no-human-winners" };
  }

  let groupName = null;
  try {
    const groupSnap = await db.doc(`groups/${gid}`).get();
    groupName = resolveGroupDisplayName(groupSnap.data() || {});
  } catch {
    // optional
  }

  const isCoWinner = humanUids.length > 1;
  const pts = Number(winnerPoints) || 0;
  const competitionLabel = String(competition.label || competition.competitionKey || "");

  let sent = 0;
  for (const uid of humanUids) {
    const lang = await getParticipantLang(uid);
    const { title, body } = buildPush({
      lang,
      groupName,
      competitionLabel,
      winnerPoints: pts,
      isCoWinner,
    });

    const pushRes = await sendPushToUsers({
      uids: [uid],
      title,
      body,
      data: {
        action: "OPEN_LEADERBOARD",
        groupId: gid,
        competitionKey: String(competition.competitionKey || ""),
      },
      channelId: "challenges_v2",
      logTag: "seasonCompetitionWinner",
    });

    sent += pushRes?.recipients || 0;
  }

  logger.info("[seasonCompetitionWinner] done", {
    groupId: gid,
    competitionKey: competition.competitionKey,
    winners: humanUids.length,
    sent,
  });

  return { ok: true, sent, winners: humanUids.length };
}
