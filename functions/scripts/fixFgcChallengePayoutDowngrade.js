/**
 * Corrige un défi FGC payé à l'ancien barème (ex. 10 pts) → FGC_WIN_POINTS actuel (5).
 *
 * Usage:
 *   cd functions
 *   node scripts/fixFgcChallengePayoutDowngrade.js 9XRK7G66klIEqpOMJTz7
 *   node scripts/fixFgcChallengePayoutDowngrade.js 9XRK7G66klIEqpOMJTz7 --apply
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { FGC_WIN_POINTS } from "../challengeScoringConstants.js";
import { isFgcEntryWinner } from "../fgc/fgcEntryPoints.js";
import { resolveCompetitionForGroupCredit } from "../leaderboard/seasonCompetitions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CHALLENGE_ID = "9XRK7G66klIEqpOMJTz7";

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../../serviceAccount.json"),
    path.join(__dirname, "../../capitaine-firebase-adminsdk-fbsvc-a0066fa0df.json"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function storedFgcPoints(entry = {}) {
  return Math.max(toNumber(entry?.payout, 0), toNumber(entry?.points, 0));
}

function dateFromYmdUTC(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0));
}

function weekKeyFromGameDate({ seasonId, fromYmd, gameDate }) {
  const fromDate = dateFromYmdUTC(fromYmd);
  const gdDate = dateFromYmdUTC(gameDate);
  if (!fromDate || !gdDate) return null;
  const delta = Math.floor((gdDate.getTime() - fromDate.getTime()) / 86400000);
  if (!Number.isFinite(delta) || delta < 0) return null;
  const weekIndex = Math.floor(delta / 7) + 1;
  return `${String(seasonId)}-W${String(weekIndex).padStart(2, "0")}`;
}

function monthKeyFromGameDate(gameDate) {
  const gd = String(gameDate || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(gd) ? gd.slice(0, 7) : null;
}

if (!getApps().length) {
  const saPath = resolveServiceAccountPath();
  if (!saPath) {
    console.error("No service account found");
    process.exit(1);
  }
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) });
}

const db = getFirestore();

async function decrementLeaderboardFgcPoints({ groupId, uid, gameYmd, delta }) {
  const pts = toNumber(delta, 0);
  if (pts <= 0) return { skipped: true, reason: "no-delta" };

  const gameDate = String(gameYmd || "").slice(0, 10);
  const comp = await resolveCompetitionForGroupCredit({ db, groupId, gameYmd: gameDate });
  if (!comp?.competitionKey) return { skipped: true, reason: "competition-closed" };

  const seasonId = String(comp.seasonId || comp.competitionKey);
  const fromYmd = String(comp.fromYmd || "");
  const weekKey = weekKeyFromGameDate({ seasonId, fromYmd, gameDate });
  const monthKey = monthKeyFromGameDate(gameDate);

  const memberRef = db.doc(
    `groups/${groupId}/leaderboards/${comp.competitionKey}/members/${uid}`
  );

  const dec = FieldValue.increment(-pts);
  const patch = {
    uid,
    pointsTotal: dec,
    fgcPoints: dec,
    "families.fgc.points": dec,
    fgcPayoutDowngradeAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (weekKey) patch[`pointsByWeek.${weekKey}`] = dec;
  if (monthKey) patch[`pointsByMonth.${monthKey}`] = dec;

  await memberRef.set(patch, { merge: true });

  return { decremented: pts, competitionKey: comp.competitionKey, weekKey, monthKey };
}

async function refreshDailyTopScoreDocs({ groupId, gameYmd }) {
  const { computeDailyGroupPoints, resolveDailyTopScorers } = await import(
    "../notifications/dailyTopScorer.js"
  );
  const ymd = String(gameYmd || "").slice(0, 10);
  const { pointsByUid } = await computeDailyGroupPoints({ groupId, gameDateYmd: ymd });
  const resolved = resolveDailyTopScorers(pointsByUid);

  const patch = {
    topScore: resolved.topScore,
    winnerUids: resolved.winnerUids,
    fgcPayoutDowngradeRefreshAt: FieldValue.serverTimestamp(),
  };

  const pushRef = db.doc(`groups/${groupId}/daily_top_scorer_pushes/${ymd}`);
  const awardRef = db.doc(`groups/${groupId}/daily_bonus_awards/${ymd}`);

  const [pushSnap, awardSnap] = await Promise.all([pushRef.get(), awardRef.get()]);
  if (pushSnap.exists) await pushRef.set(patch, { merge: true });
  if (awardSnap.exists) await awardRef.set(patch, { merge: true });

  return {
    topScore: resolved.topScore,
    winnerUids: resolved.winnerUids,
    scores: Object.fromEntries(
      [...pointsByUid.entries()].map(([id, stats]) => [id, stats.total])
    ),
  };
}

async function main() {
  const positional = process.argv.filter((a) => !a.startsWith("-"));
  const challengeId = positional[2] || DEFAULT_CHALLENGE_ID;
  const targetRaw = readArg("targetPoints");
  const targetPoints =
    targetRaw == null || targetRaw === "" ? FGC_WIN_POINTS : toNumber(targetRaw, FGC_WIN_POINTS);
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  const chRef = db.doc(`first_goal_challenges/${challengeId}`);
  const chSnap = await chRef.get();
  if (!chSnap.exists) {
    console.error("Challenge not found:", challengeId);
    process.exit(1);
  }

  const ch = chSnap.data() || {};
  const groupId = String(ch.groupId || "").trim();
  const gameYmd = String(ch.gameYmd || "").slice(0, 10);
  const winnersPreviewUids = Array.isArray(ch.winnersPreviewUids)
    ? ch.winnersPreviewUids.map(String)
    : [];

  const entriesSnap = await chRef.collection("entries").get();
  const winnerRows = [];

  for (const doc of entriesSnap.docs) {
    const entry = doc.data() || {};
    const uid = String(entry?.uid || doc.id);
    if (!isFgcEntryWinner({ ...entry, uid }, { winnersPreviewUids })) continue;

    const oldStored = storedFgcPoints(entry);
    if (oldStored <= targetPoints) {
      winnerRows.push({
        uid,
        entryId: doc.id,
        displayName: entry.displayName,
        oldStored,
        targetPoints,
        delta: 0,
        skip: true,
        reason: "already-at-or-below-target",
      });
      continue;
    }

    winnerRows.push({
      uid,
      entryId: doc.id,
      displayName: entry.displayName,
      oldStored,
      targetPoints,
      delta: oldStored - targetPoints,
      skip: false,
    });
  }

  const actionable = winnerRows.filter((r) => !r.skip && r.delta > 0);
  const plan = {
    dryRun,
    challengeId,
    groupId,
    gameYmd,
    targetPoints,
    currentPayoutTotal: ch.payoutTotal,
    currentWinnerShares: ch.winnerShares,
    winnerRows,
    actionableCount: actionable.length,
  };

  if (!actionable.length) {
    console.log(JSON.stringify({ ...plan, ok: true, message: "nothing-to-do" }, null, 2));
    return;
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ...plan,
          ok: true,
          message: "Re-run with --apply to write Firestore",
          leaderboardDeltas: actionable.map((r) => ({
            uid: r.uid,
            decrement: r.delta,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  const results = { entryUpdates: [], leaderboard: [], challenge: null, dailyRefresh: null };

  for (const row of actionable) {
    await chRef.collection("entries").doc(row.entryId).set(
      {
        payout: targetPoints,
        points: targetPoints,
        won: true,
        fgcPayoutDowngradeAt: FieldValue.serverTimestamp(),
        fgcPayoutDowngradeFrom: row.oldStored,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    results.entryUpdates.push({ entryId: row.entryId, uid: row.uid, to: targetPoints });

    const lb = await decrementLeaderboardFgcPoints({
      groupId,
      uid: row.uid,
      gameYmd,
      delta: row.delta,
    });
    results.leaderboard.push({ uid: row.uid, ...lb });
  }

  const newWinnerShares = { ...(ch.winnerShares || {}) };
  for (const row of actionable) {
    newWinnerShares[row.uid] = targetPoints;
  }
  const newPayoutTotal = Object.values(newWinnerShares).reduce(
    (sum, v) => sum + toNumber(v, 0),
    0
  );

  await chRef.set(
    {
      payoutTotal: newPayoutTotal,
      winnerShares: newWinnerShares,
      fgcPayoutDowngradeAt: FieldValue.serverTimestamp(),
      fgcPayoutDowngradeTarget: targetPoints,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  results.challenge = { payoutTotal: newPayoutTotal, winnerShares: newWinnerShares };

  if (groupId && gameYmd) {
    results.dailyRefresh = await refreshDailyTopScoreDocs({ groupId, gameYmd });
  }

  console.log(JSON.stringify({ ok: true, dryRun: false, ...plan, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
