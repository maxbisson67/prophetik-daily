/**
 * Rattrapage des bonus du soir (+5 pts) sans renvoyer de notification.
 *
 * Usage:
 *   node functions/scripts/backfillDailyBonus.js
 *   node functions/scripts/backfillDailyBonus.js --date=2026-07-26
 *   node functions/scripts/backfillDailyBonus.js --groupId=xGjajTBv3aGloLmBEmW --date=2026-07-26
 *   node functions/scripts/backfillDailyBonus.js --groupId=... --date=... --winnerUid=... --topScore=42
 */
import { initializeApp, getApps } from "firebase-admin/app";
import {
  awardDailyTopBonus,
  collectGroupDayPairsForDates,
  computeDailyGroupPoints,
  resolveDailyTopScorers,
  scanGroupDailyBonusDates,
} from "../notifications/dailyTopScorer.js";
import { appYmd, addDaysToYmd } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

async function main() {
  const groupIdArg = readArg("groupId");
  const dateArg = readArg("date") || addDaysToYmd(appYmd(new Date()), -1);
  const winnerUidArg = readArg("winnerUid");
  const topScoreArg = readArg("topScore");
  const dryRun = process.argv.includes("--dry-run");
  const scan = process.argv.includes("--scan");

  if (scan && groupIdArg) {
    const scanned = await scanGroupDailyBonusDates({
      groupId: groupIdArg,
      lookbackDays: Number(readArg("lookback") || 10),
    });
    console.log(JSON.stringify({ ok: true, scan: true, groupId: groupIdArg, scanned }, null, 2));
    return;
  }

  const pairs = groupIdArg
    ? [{ groupId: groupIdArg, gameDateYmd: String(dateArg).slice(0, 10) }]
    : await collectGroupDayPairsForDates([dateArg]);

  const results = [];

  for (const pair of pairs) {
    const { pointsByUid } = await computeDailyGroupPoints({
      groupId: pair.groupId,
      gameDateYmd: pair.gameDateYmd,
    });
    const resolved = resolveDailyTopScorers(pointsByUid);

    const winnerUids = winnerUidArg
      ? [String(winnerUidArg)]
      : resolved.winnerUids;
    const topScore =
      topScoreArg != null
        ? Number(topScoreArg)
        : resolved.topScore;

    if (dryRun) {
      results.push({
        ...pair,
        dryRun: true,
        winnerUids,
        topScore,
        computed: resolved,
        scores: Object.fromEntries(
          [...pointsByUid.entries()].map(([uid, stats]) => [uid, stats.total])
        ),
      });
      continue;
    }

    const awardRes = await awardDailyTopBonus({
      groupId: pair.groupId,
      gameDateYmd: pair.gameDateYmd,
      winnerUids,
      topScore,
    });

    results.push({
      groupId: pair.groupId,
      gameDate: pair.gameDateYmd,
      winnerUids: awardRes?.winnerUids || winnerUids,
      topScore: awardRes?.topScore ?? topScore,
      awarded: awardRes?.awarded || 0,
      skipped: awardRes?.skipped || false,
      reason: awardRes?.reason || null,
      computed: resolved,
      scores: Object.fromEntries(
        [...pointsByUid.entries()].map(([uid, stats]) => [uid, stats.total])
      ),
    });
  }

  console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
