import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { DAILY_TOP_BONUS_POINTS } from "../challengeScoringConstants.js";
import { resolveFgcEntryPoints } from "../fgc/fgcEntryPoints.js";
import { tsDefiEligibleForDailyTotals } from "../defis/tsDefiStatsEligibility.js";
import { toNumber } from "../leaderboard/leaderboard.js";
import { resolveCompetitionForGroupCredit } from "../leaderboard/seasonCompetitions.js";
import { buildDailyTopScorerPush } from "./challengeWinMessages.js";
import { NOTIFICATION_PREF_KEYS } from "./notificationPrefs.js";
import {
  fetchGroupName,
  loadParticipantDisplayNames,
  sendGroupPushByLang,
} from "./notificationUtils.js";

const db = getFirestore();

function normalizeGameDateYmd(v) {
  return String(v || "").slice(0, 10);
}

function compactYmdFromIso(ymd) {
  return normalizeGameDateYmd(ymd).replace(/-/g, "");
}

function storedValueToYmdCandidates(stored) {
  if (stored == null) return [];

  if (typeof stored?.toDate === "function") {
    try {
      const iso = stored.toDate().toISOString();
      const dashed = iso.slice(0, 10);
      return [dashed, dashed.replace(/-/g, "")];
    } catch {
      return [];
    }
  }

  if (stored instanceof Date && !Number.isNaN(stored.getTime())) {
    const dashed = stored.toISOString().slice(0, 10);
    return [dashed, dashed.replace(/-/g, "")];
  }

  const raw = String(stored || "").trim();
  if (!raw) return [];

  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) {
    const compact = digits.slice(0, 8);
    return [
      raw,
      compact,
      `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`,
    ];
  }

  return [raw];
}

function ymdMatchesStored(stored, targetYmd) {
  const targetDashed = normalizeGameDateYmd(targetYmd);
  const targetCompact = compactYmdFromIso(targetDashed);
  if (!targetDashed) return false;

  const candidates = storedValueToYmdCandidates(stored);
  return candidates.some((candidate) => {
    const dashed = normalizeGameDateYmd(candidate);
    const compact = compactYmdFromIso(dashed || candidate);
    return dashed === targetDashed || compact === targetCompact || candidate === targetCompact;
  });
}

function dedupeDocs(docs = []) {
  const byId = new Map();
  for (const doc of docs) {
    if (doc?.id) byId.set(doc.id, doc);
  }
  return [...byId.values()];
}

function parseTpBundleDayPoints(entry = {}) {
  const pickResults = { ...(entry.pickResults || {}) };
  for (const [key, value] of Object.entries(entry)) {
    if (!key.startsWith("pickResults.")) continue;
    if (!value || typeof value !== "object") continue;
    pickResults[key.slice("pickResults.".length)] = value;
  }

  let pointsFromResults = 0;
  for (const result of Object.values(pickResults)) {
    if (!result || typeof result !== "object") continue;
    pointsFromResults += toNumber(result.points, 0);
  }

  const totalFromField = toNumber(entry.totalPoints, 0);
  return pointsFromResults > 0 ? Math.max(totalFromField, pointsFromResults) : totalFromField;
}

function tpBundleHasScoredData(bundle = {}, entries = []) {
  if (bundleHasScoredSlots(bundle)) return true;
  return (entries || []).some((entry) => parseTpBundleDayPoints(entry) > 0);
}

function parseTsParticipationDayPoints(data = {}) {
  const finalPoints = toNumber(data.finalPoints, 0);
  const livePoints = toNumber(data.livePoints, 0);
  return finalPoints > 0 ? finalPoints : livePoints;
}

function bundleHasScoredSlots(bundle = {}) {
  if (bundle.payoutApplied === true) return true;
  const status = String(bundle.status || "").toLowerCase();
  if (["decided", "partial", "closed"].includes(status)) return true;
  const games = Array.isArray(bundle.games) ? bundle.games : [];
  return games.some((g) => g?.payoutApplied === true);
}

function dailyPushRef(groupId, gameDateYmd) {
  const gid = String(groupId || "").trim();
  const ymd = normalizeGameDateYmd(gameDateYmd);
  return db.doc(`groups/${gid}/daily_top_scorer_pushes/${ymd}`);
}

function dailyBonusAwardRef(groupId, gameDateYmd) {
  const gid = String(groupId || "").trim();
  const ymd = normalizeGameDateYmd(gameDateYmd);
  return db.doc(`groups/${gid}/daily_bonus_awards/${ymd}`);
}

export async function awardDailyTopBonus({
  groupId,
  gameDateYmd,
  winnerUids: winnerUidsHint = null,
  topScore: topScoreHint = null,
}) {
  const gid = String(groupId || "").trim();
  const ymd = normalizeGameDateYmd(gameDateYmd);

  if (!gid || !ymd) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  const awardRef = dailyBonusAwardRef(gid, ymd);
  const existingSnap = await awardRef.get();
  if (existingSnap.exists && existingSnap.data()?.awardedAt) {
    return { ok: true, skipped: true, reason: "already-awarded" };
  }

  let winnerUids = Array.from(new Set((winnerUidsHint || []).map(String).filter(Boolean)));
  let topScore = topScoreHint != null ? Number(topScoreHint) : null;

  if (!winnerUids.length || topScore == null) {
    const pushSnap = await dailyPushRef(gid, ymd).get();
    const pushData = pushSnap.exists ? pushSnap.data() || {} : {};
    if (Array.isArray(pushData.winnerUids) && pushData.winnerUids.length) {
      winnerUids = pushData.winnerUids.map(String).filter(Boolean);
      topScore = pushData.topScore != null ? Number(pushData.topScore) : topScore;
    }
  }

  if (!winnerUids.length || topScore == null) {
    const { pointsByUid } = await computeDailyGroupPoints({ groupId: gid, gameDateYmd: ymd });
    const resolved = resolveDailyTopScorers(pointsByUid);
    winnerUids = resolved.winnerUids;
    topScore = resolved.topScore;
  }

  if (!winnerUids.length) {
    return { ok: true, skipped: true, reason: "no-scorers" };
  }

  if (topScore == null || topScore <= 0) {
    if ((winnerUidsHint || []).length) {
      topScore = Math.max(1, Number(topScoreHint) || 1);
    } else {
      return { ok: true, skipped: true, reason: "no-scorers" };
    }
  }

  const comp = await resolveCompetitionForGroupCredit({ db, groupId: gid, gameYmd: ymd });
  if (!comp?.competitionKey) {
    return { ok: false, reason: "competition-closed" };
  }

  const bonusPts = DAILY_TOP_BONUS_POINTS;
  const batch = db.batch();

  for (const uid of winnerUids) {
    const memberRef = db.doc(
      `groups/${gid}/leaderboards/${comp.competitionKey}/members/${uid}`
    );
    batch.set(
      memberRef,
      {
        uid,
        dailyBonusWins: FieldValue.increment(1),
        dailyBonusPoints: FieldValue.increment(bonusPts),
        pointsTotal: FieldValue.increment(bonusPts),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  batch.set(
    awardRef,
    {
      awardedAt: FieldValue.serverTimestamp(),
      winnerUids,
      topScore,
      bonusPoints: bonusPts,
      gameDate: ymd,
      competitionKey: comp.competitionKey,
    },
    { merge: true }
  );

  await batch.commit();

  logger.info("[dailyTopBonus] awarded", {
    groupId: gid,
    gameDate: ymd,
    winners: winnerUids.length,
    topScore,
    bonusPoints: bonusPts,
    competitionKey: comp.competitionKey,
  });

  return { ok: true, awarded: winnerUids.length, winnerUids, topScore, bonusPoints: bonusPts };
}

export async function computeDailyGroupPoints({ groupId, gameDateYmd }) {
  const gid = String(groupId || "").trim();
  const ymd = normalizeGameDateYmd(gameDateYmd);

  if (!gid || !ymd) {
    return { pointsByUid: new Map(), breakdown: { ts: 0, fgc: 0, tp: 0 } };
  }

  const pointsByUid = new Map();

  function addPoints(uid, pts, source) {
    const id = String(uid || "").trim();
    if (!id) return;
    const amount = toNumber(pts, 0);
    if (!id || amount <= 0) return;
    const prev = pointsByUid.get(id) || { total: 0, ts: 0, fgc: 0, tp: 0 };
    prev.total += amount;
    prev[source] = (prev[source] || 0) + amount;
    pointsByUid.set(id, prev);
  }

  const [tsGroupSnap, fgcGroupSnap, tpGroupSnap] = await Promise.all([
    db.collection("defis").where("groupId", "==", gid).where("type", "==", 3).get(),
    db.collection("first_goal_challenges").where("groupId", "==", gid).get(),
    db.collection("team_prediction_bundles").where("groupId", "==", gid).get(),
  ]);

  for (const defiDoc of tsGroupSnap.docs) {
    const defi = defiDoc.data() || {};
    const defiDate = defi.gameDate || defi.gameYmd;
    if (!ymdMatchesStored(defiDate, ymd)) continue;
    if (!tsDefiEligibleForDailyTotals(defi)) continue;

    const partsSnap = await defiDoc.ref.collection("participations").get();
    for (const partDoc of partsSnap.docs) {
      addPoints(partDoc.id, parseTsParticipationDayPoints(partDoc.data() || {}), "ts");
    }
  }

  for (const chDoc of fgcGroupSnap.docs) {
    const ch = chDoc.data() || {};
    if (!ymdMatchesStored(ch.gameYmd, ymd)) continue;

    const winnersPreviewUids = Array.isArray(ch.winnersPreviewUids)
      ? ch.winnersPreviewUids.map(String)
      : [];
    const entriesSnap = await chDoc.ref.collection("entries").get();

    for (const entryDoc of entriesSnap.docs) {
      const entry = entryDoc.data() || {};
      const uid = String(entry?.uid || entry?.pickedBy || entryDoc.id);
      const points = resolveFgcEntryPoints(
        { ...entry, uid },
        { winnersPreviewUids }
      );
      addPoints(uid, points, "fgc");
    }
  }

  for (const bundleDoc of tpGroupSnap.docs) {
    const bundle = bundleDoc.data() || {};
    if (!ymdMatchesStored(bundle.gameYmd, ymd)) continue;

    const entriesSnap = await bundleDoc.ref.collection("entries").get();
    const entries = entriesSnap.docs.map((doc) => doc.data() || {});
    if (!tpBundleHasScoredData(bundle, entries)) continue;

    for (const entryDoc of entriesSnap.docs) {
      const entry = entryDoc.data() || {};
      const uid = String(entry?.uid || entryDoc.id);
      addPoints(uid, parseTpBundleDayPoints(entry), "tp");
    }
  }

  return { pointsByUid };
}

export async function scanGroupDailyBonusDates({ groupId, lookbackDays = 7 } = {}) {
  const gid = String(groupId || "").trim();
  if (!gid) return [];

  const [tsGroupSnap, fgcGroupSnap, tpGroupSnap] = await Promise.all([
    db.collection("defis").where("groupId", "==", gid).where("type", "==", 3).get(),
    db.collection("first_goal_challenges").where("groupId", "==", gid).get(),
    db.collection("team_prediction_bundles").where("groupId", "==", gid).get(),
  ]);

  const dateSet = new Set();

  function collectDates(value) {
    for (const candidate of storedValueToYmdCandidates(value)) {
      const dashed = normalizeGameDateYmd(
        candidate.length === 8 && !candidate.includes("-")
          ? `${candidate.slice(0, 4)}-${candidate.slice(4, 6)}-${candidate.slice(6, 8)}`
          : candidate
      );
      if (dashed) dateSet.add(dashed);
    }
  }

  for (const doc of tsGroupSnap.docs) {
    const data = doc.data() || {};
    collectDates(data.gameDate || data.gameYmd);
  }
  for (const doc of fgcGroupSnap.docs) {
    collectDates((doc.data() || {}).gameYmd);
  }
  for (const doc of tpGroupSnap.docs) {
    collectDates((doc.data() || {}).gameYmd);
  }

  const sortedDates = [...dateSet].sort().reverse().slice(0, Math.max(1, Number(lookbackDays) || 7));
  const results = [];

  for (const gameDateYmd of sortedDates) {
    const { pointsByUid } = await computeDailyGroupPoints({ groupId: gid, gameDateYmd });
    const resolved = resolveDailyTopScorers(pointsByUid);
    results.push({
      gameDateYmd,
      winnerUids: resolved.winnerUids,
      topScore: resolved.topScore,
      scores: Object.fromEntries(
        [...pointsByUid.entries()].map(([uid, stats]) => [uid, stats.total])
      ),
    });
  }

  return results;
}

export function resolveDailyTopScorers(pointsByUid = new Map()) {
  let maxTotal = -Infinity;
  const rows = [];

  for (const [uid, stats] of pointsByUid.entries()) {
    const total = toNumber(stats?.total, 0);
    if (total <= 0) continue;
    rows.push({ uid, total, breakdown: stats });
    if (total > maxTotal) maxTotal = total;
  }

  if (!rows.length || !Number.isFinite(maxTotal)) {
    return { winnerUids: [], topScore: null, rows: [] };
  }

  const winnerUids = rows.filter((r) => r.total === maxTotal).map((r) => r.uid);
  return { winnerUids, topScore: maxTotal, rows };
}

export async function notifyDailyTopScorer({
  groupId,
  gameDateYmd,
  winnerUids: winnerUidsHint = null,
  topScore: topScoreHint = null,
}) {
  const gid = String(groupId || "").trim();
  const ymd = normalizeGameDateYmd(gameDateYmd);

  if (!gid || !ymd) {
    return { ok: true, skipped: true, reason: "missing-input" };
  }

  let winnerUids = Array.from(new Set((winnerUidsHint || []).map(String).filter(Boolean)));
  let topScore = topScoreHint != null ? Number(topScoreHint) : null;

  if (!winnerUids.length || topScore == null) {
    const { pointsByUid } = await computeDailyGroupPoints({ groupId: gid, gameDateYmd: ymd });
    const resolved = resolveDailyTopScorers(pointsByUid);
    winnerUids = resolved.winnerUids;
    topScore = resolved.topScore;
  }

  if (!winnerUids.length || topScore == null || topScore <= 0) {
    const pushRef = dailyPushRef(gid, ymd);
    await pushRef.set(
      {
        skippedAt: FieldValue.serverTimestamp(),
        skippedReason: "no-scorers",
        gameDate: ymd,
      },
      { merge: true }
    );
    return { ok: true, skipped: true, reason: "no-scorers" };
  }

  const awardRes = await awardDailyTopBonus({
    groupId: gid,
    gameDateYmd: ymd,
    winnerUids,
    topScore,
  });

  if (awardRes?.ok === false) {
    logger.warn("[dailyTopScorerPush] bonus award failed", {
      groupId: gid,
      gameDate: ymd,
      reason: awardRes?.reason || null,
      winnerUids,
      topScore,
    });
  }

  const pushRef = dailyPushRef(gid, ymd);
  const existingSnap = await pushRef.get();
  if (existingSnap.exists && existingSnap.data()?.sentAt) {
    return {
      ok: true,
      skipped: true,
      reason: "already-sent",
      winnerUids,
      topScore,
      bonusAwarded: awardRes?.awarded || 0,
      bonusSkipped: awardRes?.skipped || false,
      bonusReason: awardRes?.reason || null,
    };
  }

  const nameByUid = await loadParticipantDisplayNames(winnerUids);
  const winnerNames = winnerUids.map((uid) => nameByUid.get(uid) || uid);
  const groupName = await fetchGroupName(gid);

  const pushRes = await sendGroupPushByLang({
    groupId: gid,
    buildMessage: (lang) =>
      buildDailyTopScorerPush({
        lang,
        groupName,
        winnerNames,
        totalPoints: topScore,
        bonusPoints: DAILY_TOP_BONUS_POINTS,
        gameDateYmd: ymd,
      }),
    data: {
      action: "OPEN_LEADERBOARD",
      groupId: gid,
      gameDate: ymd,
      kind: "daily_top_scorer",
    },
    channelId: "challenges_v2",
    logTag: "dailyTopScorerPush",
    notificationPrefKey: NOTIFICATION_PREF_KEYS.TS_WIN,
  });

  if (pushRes?.sent > 0) {
    await pushRef.set(
      {
        sentAt: FieldValue.serverTimestamp(),
        winnerUids,
        topScore,
        gameDate: ymd,
        recipients: pushRes?.recipients || 0,
      },
      { merge: true }
    );
  }

  logger.info("[dailyTopScorerPush] done", {
    groupId: gid,
    gameDate: ymd,
    winners: winnerUids.length,
    topScore,
    sent: pushRes?.sent || 0,
    recipients: pushRes?.recipients || 0,
  });

  return {
    ok: true,
    sent: pushRes?.sent || 0,
    winnerUids,
    topScore,
    bonusAwarded: awardRes?.awarded || 0,
    bonusPoints: awardRes?.bonusPoints || DAILY_TOP_BONUS_POINTS,
  };
}

export async function collectGroupDayPairsForDates(gameDates = []) {
  const dates = Array.from(
    new Set((gameDates || []).map((d) => normalizeGameDateYmd(d)).filter(Boolean))
  );
  if (!dates.length) return [];

  const pairs = new Map();

  function addPair(groupId, gameDate) {
    const gid = String(groupId || "").trim();
    const ymd = normalizeGameDateYmd(gameDate);
    if (!gid || !ymd) return;
    pairs.set(`${gid}|${ymd}`, { groupId: gid, gameDateYmd: ymd });
  }

  for (const ymd of dates) {
    const ymdCompact = compactYmdFromIso(ymd);

    const tsSnap = await db
      .collection("defis")
      .where("gameDate", "==", ymd)
      .where("type", "==", 3)
      .where("status", "in", ["completed", "open", "live", "awaiting_result"])
      .get();
    tsSnap.docs.forEach((doc) => addPair(doc.data()?.groupId, ymd));

    const fgcSnap = await db
      .collection("first_goal_challenges")
      .where("gameYmd", "==", ymd)
      .where("status", "in", ["decided", "closed", "open", "live", "locked"])
      .get();
    fgcSnap.docs.forEach((doc) => addPair(doc.data()?.groupId, ymd));

    const tpSnap = await db.collection("team_prediction_bundles").where("gameYmd", "==", ymdCompact).get();
    tpSnap.docs.forEach((doc) => addPair(doc.data()?.groupId, ymd));
  }

  return [...pairs.values()];
}
