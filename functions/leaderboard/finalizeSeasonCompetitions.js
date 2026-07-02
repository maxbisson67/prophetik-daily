import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { APP_TZ, appYmd } from "../ProphetikDate.js";
import { rebuildLeaderboardSeasonForGroupLogic } from "./leaderboard.js";
import {
  computeExAequoWinners,
  normalizeSport,
} from "./seasonCompetitionCore.js";
import {
  listCompetitionsReadyToFinalize,
  loadCompetitionCatalog,
  invalidateCompetitionCatalogCache,
} from "./seasonCompetitions.js";
import { fetchActiveMemberUids } from "./leaderboardRankUtils.js";
import { notifySeasonCompetitionWinners } from "../notifications/notifySeasonCompetitionWinners.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

const GRACE_DAYS = 2;
const MAX_GROUPS_PER_COMPETITION = 300;

function isActiveGroup(data = {}) {
  const status = String(data?.status || "").toLowerCase();
  if (data?.active === false) return false;
  if (status === "archived" || status === "deleted") return false;
  return true;
}

export async function finalizeGroupSeasonCompetition({
  groupId,
  competition,
  skipRebuild = false,
} = {}) {
  const gid = String(groupId || "").trim();
  const comp = competition || {};
  const competitionKey = String(comp.competitionKey || "").trim();

  if (!gid || !competitionKey) {
    return { ok: false, reason: "missing-input" };
  }

  const metaRef = db.doc(`groups/${gid}/leaderboards/${competitionKey}`);
  const metaSnap = await metaRef.get();
  const meta = metaSnap.data() || {};

  if (meta.winnerDeclaredAt) {
    return { ok: true, skipped: true, reason: "already-declared", groupId: gid, competitionKey };
  }

  if (!skipRebuild) {
    await rebuildLeaderboardSeasonForGroupLogic({
      groupId: gid,
      seasonId: competitionKey,
      fromYmd: comp.fromYmd,
      toYmd: comp.toYmd,
      clearDirty: false,
    });
  }

  const memberUids = await fetchActiveMemberUids(gid);
  const membersSnap = await db
    .collection(`groups/${gid}/leaderboards/${competitionKey}/members`)
    .get();

  const pointsByUid = new Map();
  membersSnap.forEach((doc) => {
    pointsByUid.set(doc.id, Number(doc.data()?.pointsTotal ?? 0) || 0);
  });

  for (const uid of memberUids) {
    if (!pointsByUid.has(uid)) pointsByUid.set(uid, 0);
  }

  const winnerUids = computeExAequoWinners(memberUids, pointsByUid);
  const winnerPoints = winnerUids.length ? Number(pointsByUid.get(winnerUids[0])) || 0 : 0;

  await metaRef.set(
    {
      status: "finalized",
      competitionKey,
      seasonId: comp.seasonId || competitionKey,
      groupId: gid,
      sport: comp.sport || null,
      phase: comp.phase || null,
      label: comp.label || competitionKey,
      fromYmd: comp.fromYmd || null,
      toYmd: comp.toYmd || null,
      winnerUids,
      winnerPoints,
      winnerDeclaredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  try {
    await notifySeasonCompetitionWinners({
      groupId: gid,
      competition: comp,
      winnerUids,
      winnerPoints,
    });
  } catch (e) {
    logger.warn("[finalizeSeasonCompetitions] push failed", {
      groupId: gid,
      competitionKey,
      error: String(e?.message || e),
    });
  }

  return {
    ok: true,
    groupId: gid,
    competitionKey,
    winnerUids,
    winnerPoints,
    membersCount: memberUids.length,
  };
}

export async function finalizeSeasonCompetitionCatalogEntry({
  competition,
  todayYmd,
  graceDays = GRACE_DAYS,
} = {}) {
  const comp = competition || {};
  const competitionKey = String(comp.competitionKey || "").trim();
  if (!competitionKey) return { ok: false, reason: "missing-competition" };

  const catalogRef = db.doc(`seasonCompetitions/${competitionKey}`);
  const catalogSnap = await catalogRef.get();
  const catalogData = catalogSnap.data() || {};

  if (String(catalogData.status || "").toLowerCase() === "finalized") {
    return { ok: true, skipped: true, reason: "catalog-already-finalized", competitionKey };
  }

  const groupsSnap = await db.collection("groups").limit(MAX_GROUPS_PER_COMPETITION).get();
  const targetSport = normalizeSport(comp.sport);

  let groupsProcessed = 0;
  let winnersDeclared = 0;

  for (const groupDoc of groupsSnap.docs) {
    const group = groupDoc.data() || {};
    if (!isActiveGroup(group)) continue;
    if (normalizeSport(group.sport) !== targetSport) continue;

    const result = await finalizeGroupSeasonCompetition({
      groupId: groupDoc.id,
      competition: comp,
    });

    groupsProcessed += 1;
    if (result?.winnerUids?.length) winnersDeclared += 1;
  }

  await catalogRef.set(
    {
      status: "finalized",
      finalizedAt: FieldValue.serverTimestamp(),
      finalizedOnYmd: String(todayYmd || "").slice(0, 10) || null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  invalidateCompetitionCatalogCache();

  return {
    ok: true,
    competitionKey,
    groupsProcessed,
    winnersDeclared,
  };
}

export async function runFinalizeSeasonCompetitions({
  todayYmd = appYmd(new Date()),
  graceDays = GRACE_DAYS,
} = {}) {
  const ready = await listCompetitionsReadyToFinalize({
    db,
    todayYmd,
    graceDays,
  });

  if (!ready.length) {
    return { ok: true, processed: 0, competitions: [] };
  }

  const results = [];
  for (const competition of ready) {
    try {
      const result = await finalizeSeasonCompetitionCatalogEntry({
        competition,
        todayYmd,
        graceDays,
      });
      results.push(result);
    } catch (e) {
      logger.error("[finalizeSeasonCompetitions] competition failed", {
        competitionKey: competition?.competitionKey,
        error: String(e?.message || e),
      });
      results.push({
        ok: false,
        competitionKey: competition?.competitionKey,
        error: String(e?.message || e),
      });
    }
  }

  return { ok: true, processed: results.length, competitions: results };
}

export const finalizeSeasonCompetitions = onSchedule(
  {
    schedule: "30 5 * * *",
    timeZone: APP_TZ,
    region: "us-central1",
  },
  async () => {
    const todayYmd = appYmd(new Date());
    logger.info("[finalizeSeasonCompetitions] start", { todayYmd, graceDays: GRACE_DAYS });

    const out = await runFinalizeSeasonCompetitions({ todayYmd, graceDays: GRACE_DAYS });

    logger.info("[finalizeSeasonCompetitions] done", out);
    return out;
  }
);

export { loadCompetitionCatalog };
