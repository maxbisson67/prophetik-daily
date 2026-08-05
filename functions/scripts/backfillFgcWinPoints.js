/**
 * Rattrapage FGC : entries gagnantes encore à 5 pts → 10 pts (FGC_WIN_POINTS).
 * Corrige aussi le classement saison (+delta) et le topScore des docs bonus du soir.
 *
 * Usage:
 *   cd functions
 *   node scripts/backfillFgcWinPoints.js --dry-run
 *   node scripts/backfillFgcWinPoints.js --groupId=WxGjajTBv3aGloLmBEmW --date=2026-07-30
 *   node scripts/backfillFgcWinPoints.js --apply
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { FGC_WIN_POINTS } from "../challengeScoringConstants.js";
import { resolveFgcEntryPoints, isFgcEntryWinner } from "../fgc/fgcEntryPoints.js";
import {
  computeDailyGroupPoints,
  resolveDailyTopScorers,
} from "../notifications/dailyTopScorer.js";
import { resolveCompetitionForGroupCredit } from "../leaderboard/seasonCompetitions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../../capitaine-firebase-adminsdk-fbsvc-a0066fa0df.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
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

function ymdMatches(raw, targetYmd) {
  const target = String(targetYmd || "").slice(0, 10);
  const rawStr = String(raw || "").trim();
  if (!target || !rawStr) return false;
  const compact = target.replace(/-/g, "");
  return rawStr.startsWith(target) || rawStr.startsWith(compact);
}

if (!getApps().length) {
  const saPath = resolveServiceAccountPath();
  initializeApp(saPath ? { credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) } : undefined);
}

const db = getFirestore();

async function creditLeaderboardDelta({ groupId, uid, gameYmd, delta }) {
  const pts = toNumber(delta, 0);
  if (pts <= 0) return { skipped: true, reason: "no-delta" };

  const comp = await resolveCompetitionForGroupCredit({ db, groupId, gameYmd });
  if (!comp?.competitionKey) return { skipped: true, reason: "competition-closed" };

  const memberRef = db.doc(
    `groups/${groupId}/leaderboards/${comp.competitionKey}/members/${uid}`
  );

  await memberRef.set(
    {
      uid,
      pointsTotal: FieldValue.increment(pts),
      fgcPoints: FieldValue.increment(pts),
      "families.fgc.points": FieldValue.increment(pts),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { credited: pts, competitionKey: comp.competitionKey };
}

async function refreshDailyTopScoreDocs({ groupId, gameYmd }) {
  const ymd = String(gameYmd || "").slice(0, 10);
  const { pointsByUid } = await computeDailyGroupPoints({ groupId, gameDateYmd: ymd });
  const resolved = resolveDailyTopScorers(pointsByUid);

  const patch = {
    topScore: resolved.topScore,
    winnerUids: resolved.winnerUids,
    backfillAt: FieldValue.serverTimestamp(),
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
  const groupIdFilter = readArg("groupId");
  const dateFilter = readArg("date");
  const dryRun = !process.argv.includes("--apply");

  const challengesSnap = await db.collection("first_goal_challenges").get();
  const touchedDays = new Set();
  const entryUpdates = [];
  const leaderboardCredits = [];

  for (const chDoc of challengesSnap.docs) {
    const ch = chDoc.data() || {};
    const groupId = String(ch.groupId || "").trim();
    const gameYmd = String(ch.gameYmd || "").slice(0, 10);

    if (groupIdFilter && groupId !== groupIdFilter) continue;
    if (dateFilter && !ymdMatches(gameYmd, dateFilter)) continue;
    if (!groupId || !gameYmd) continue;

    const winnersPreviewUids = Array.isArray(ch.winnersPreviewUids)
      ? ch.winnersPreviewUids.map(String)
      : [];

    const entriesSnap = await chDoc.ref.collection("entries").get();

    for (const entryDoc of entriesSnap.docs) {
      const entry = entryDoc.data() || {};
      const uid = String(entry?.uid || entryDoc.id);
      if (!isFgcEntryWinner({ ...entry, uid }, { winnersPreviewUids })) continue;

      const oldStored = storedFgcPoints(entry);
      const resolved = resolveFgcEntryPoints({ ...entry, uid }, { winnersPreviewUids });
      const delta = resolved - Math.max(oldStored, 0);

      if (resolved <= 0 || delta <= 0) continue;

      entryUpdates.push({
        challengeId: chDoc.id,
        entryId: entryDoc.id,
        groupId,
        gameYmd,
        uid,
        oldStored,
        resolved,
        delta,
        payoutApplied: ch.payoutApplied === true,
      });
    }
  }

  for (const row of entryUpdates) {
    if (dryRun) continue;

    await db.doc(`first_goal_challenges/${row.challengeId}/entries/${row.entryId}`).set(
      {
        payout: FGC_WIN_POINTS,
        points: FGC_WIN_POINTS,
        won: true,
        backfillFgcPointsAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (row.payoutApplied) {
      const credit = await creditLeaderboardDelta({
        groupId: row.groupId,
        uid: row.uid,
        gameYmd: row.gameYmd,
        delta: row.delta,
      });
      leaderboardCredits.push({ ...row, credit });
    }

    touchedDays.add(`${row.groupId}|${row.gameYmd}`);
  }

  const dailyRefreshes = [];
  for (const key of touchedDays) {
    const [groupId, gameYmd] = key.split("|");
    if (dryRun) {
      dailyRefreshes.push({ groupId, gameYmd, dryRun: true });
      continue;
    }
    const refreshed = await refreshDailyTopScoreDocs({ groupId, gameYmd });
    dailyRefreshes.push({ groupId, gameYmd, ...refreshed });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        fgcWinPoints: FGC_WIN_POINTS,
        entryUpdates,
        leaderboardCredits,
        dailyRefreshes,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
