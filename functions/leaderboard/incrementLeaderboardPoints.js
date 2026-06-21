import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { db, toNumber } from "./leaderboard.js";
import { getCurrentSeasonConfig } from "./currentSeason.js";

function dateFromYmdUTC(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0));
}

function diffDaysUTC(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

function weekKeyFromGameDate({ seasonId, fromYmd, gameDate }) {
  const fromDate = dateFromYmdUTC(fromYmd);
  const gdDate = dateFromYmdUTC(gameDate);
  if (!fromDate || !gdDate) return null;

  const delta = diffDaysUTC(fromDate, gdDate);
  if (!Number.isFinite(delta) || delta < 0) return null;

  const weekIndex = Math.floor(delta / 7) + 1;
  const wk = String(weekIndex).padStart(2, "0");
  return `${String(seasonId)}-W${wk}`;
}

function monthKeyFromGameDate(gameDate) {
  const gd = String(gameDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gd)) return null;
  return gd.slice(0, 7);
}

function gameDateFromYmd(v) {
  const compact = String(v || "").replace(/\D/g, "");
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return String(v || "").slice(0, 10);
}

/**
 * Crédite immédiatement les points TP confirmés d'un match au classement saison.
 * Le rebuild nocturne reste la source de vérité pour réconciliation.
 */
export async function incrementLeaderboardTpSlotPoints({
  groupId,
  uid,
  points,
  won = false,
  gameYmd,
  recordPlay = false,
}) {
  const gid = String(groupId || "");
  const userId = String(uid || "");
  const pts = toNumber(points, 0);

  if (!gid || !userId) {
    return { ok: false, reason: "invalid-input" };
  }

  if (pts <= 0 && !recordPlay) {
    return { ok: false, reason: "no-op" };
  }

  const season = await getCurrentSeasonConfig(db);
  const gameDate = gameDateFromYmd(gameYmd);
  const weekKey = weekKeyFromGameDate({
    seasonId: season.seasonId,
    fromYmd: season.fromYmd,
    gameDate,
  });
  const monthKey = monthKeyFromGameDate(gameDate);

  const memberRef = db.doc(
    `groups/${gid}/leaderboards/${season.seasonId}/members/${userId}`
  );

  const update = {
    uid: userId,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (pts > 0) {
    update.pointsTotal = FieldValue.increment(pts);
    update.tpPoints = FieldValue.increment(pts);
    update["families.tp.points"] = FieldValue.increment(pts);
  }

  if (pts > 0 && weekKey) {
    update[`pointsByWeek.${weekKey}`] = FieldValue.increment(pts);
    if (won) update[`winsByWeek.${weekKey}`] = FieldValue.increment(1);
  }

  if (pts > 0 && monthKey) {
    update[`pointsByMonth.${monthKey}`] = FieldValue.increment(pts);
    if (won) update[`winsByMonth.${monthKey}`] = FieldValue.increment(1);
  }

  if (won) {
    update.wins = FieldValue.increment(1);
    update.tpWins = FieldValue.increment(1);
    update["families.tp.wins"] = FieldValue.increment(1);
  }

  if (recordPlay) {
    update.participations = FieldValue.increment(1);
    update.tpPlays = FieldValue.increment(1);
    update["families.tp.plays"] = FieldValue.increment(1);
  }

  await memberRef.set(update, { merge: true });

  logger.info("[leaderboard] TP slot points credited live", {
    groupId: gid,
    uid: userId,
    points: pts,
    won,
    gameDate,
    recordPlay,
    seasonId: season.seasonId,
  });

  return { ok: true, seasonId: season.seasonId, points: pts };
}

function parseFgcLeaderboardPoints(entry = {}, winnersPreviewUids = []) {
  const payout = toNumber(entry?.payout, 0);
  const uid = String(entry?.uid || entry?.pickedBy || "");
  const won =
    entry?.won === true ||
    payout > 0 ||
    winnersPreviewUids.includes(uid);

  const points = payout > 0 ? payout : won ? 1 : 0;
  return { points, won };
}

/**
 * Crédite immédiatement les points FGC confirmés au classement saison.
 */
export async function incrementLeaderboardFgcEntry({
  groupId,
  uid,
  points,
  won = false,
  gameYmd,
}) {
  const gid = String(groupId || "");
  const userId = String(uid || "");
  const pts = toNumber(points, 0);

  if (!gid || !userId) {
    return { ok: false, reason: "invalid-input" };
  }

  const season = await getCurrentSeasonConfig(db);
  const gameDate = gameDateFromYmd(gameYmd);
  const weekKey = weekKeyFromGameDate({
    seasonId: season.seasonId,
    fromYmd: season.fromYmd,
    gameDate,
  });
  const monthKey = monthKeyFromGameDate(gameDate);

  const memberRef = db.doc(
    `groups/${gid}/leaderboards/${season.seasonId}/members/${userId}`
  );

  const update = {
    uid: userId,
    participations: FieldValue.increment(1),
    fgcPlays: FieldValue.increment(1),
    "families.fgc.plays": FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (pts > 0) {
    update.pointsTotal = FieldValue.increment(pts);
    update.fgcPoints = FieldValue.increment(pts);
    update["families.fgc.points"] = FieldValue.increment(pts);
  }

  if (weekKey && pts > 0) {
    update[`pointsByWeek.${weekKey}`] = FieldValue.increment(pts);
  }
  if (monthKey && pts > 0) {
    update[`pointsByMonth.${monthKey}`] = FieldValue.increment(pts);
  }

  if (won) {
    update.wins = FieldValue.increment(1);
    update.fgcWins = FieldValue.increment(1);
    update["families.fgc.wins"] = FieldValue.increment(1);
    if (weekKey) update[`winsByWeek.${weekKey}`] = FieldValue.increment(1);
    if (monthKey) update[`winsByMonth.${monthKey}`] = FieldValue.increment(1);
  }

  await memberRef.set(update, { merge: true });

  logger.info("[leaderboard] FGC points credited live", {
    groupId: gid,
    uid: userId,
    points: pts,
    won,
    gameDate,
    seasonId: season.seasonId,
  });

  return { ok: true, seasonId: season.seasonId, points: pts };
}

export async function applyFgcChallengeLiveLeaderboard({ groupId, challengeId, challenge }) {
  if (challenge?.leaderboardLiveAppliedAt) {
    return { ok: true, skipped: true, reason: "already-applied" };
  }

  const gid = String(groupId || challenge?.groupId || "");
  const cid = String(challengeId || "");
  if (!gid || !cid) return { ok: false, reason: "missing-input" };

  const winnersPreviewUids = Array.isArray(challenge?.winnersPreviewUids)
    ? challenge.winnersPreviewUids.map(String)
    : [];

  const entriesSnap = await db.collection(`first_goal_challenges/${cid}/entries`).get();
  let applied = 0;

  for (const doc of entriesSnap.docs) {
    const entry = doc.data() || {};
    const uid = String(entry?.uid || doc.id);
    if (!uid) continue;

    const { points, won } = parseFgcLeaderboardPoints(
      { ...entry, uid },
      winnersPreviewUids
    );

    await incrementLeaderboardFgcEntry({
      groupId: gid,
      uid,
      points,
      won,
      gameYmd: challenge?.gameYmd,
    });
    applied += 1;
  }

  await db.doc(`first_goal_challenges/${cid}`).set(
    {
      leaderboardLiveAppliedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, applied };
}
