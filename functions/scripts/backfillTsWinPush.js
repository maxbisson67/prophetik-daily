/**
 * Rattrapage des notifications « plus de points hier » (SOLO + DUO + TRIO).
 *
 * Usage:
 *   node functions/scripts/backfillTsWinPush.js
 *   node functions/scripts/backfillTsWinPush.js --date=2026-07-08
 *   node functions/scripts/backfillTsWinPush.js --groupId=abc123
 */
import { initializeApp, getApps } from "firebase-admin/app";
import {
  collectGroupDayPairsForDates,
  notifyDailyTopScorer,
  awardDailyTopBonus,
  computeDailyGroupPoints,
  resolveDailyTopScorers,
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
  const dryRun = process.argv.includes("--dry-run");

  const pairs = groupIdArg
    ? [{ groupId: groupIdArg, gameDateYmd: String(dateArg).slice(0, 10) }]
    : await collectGroupDayPairsForDates([dateArg]);

  const results = [];

  for (const pair of pairs) {
    if (dryRun) {
      const { pointsByUid } = await computeDailyGroupPoints({
        groupId: pair.groupId,
        gameDateYmd: pair.gameDateYmd,
      });
      const resolved = resolveDailyTopScorers(pointsByUid);
      results.push({ ...pair, dryRun: true, ...resolved });
      continue;
    }

    const { pointsByUid } = await computeDailyGroupPoints({
      groupId: pair.groupId,
      gameDateYmd: pair.gameDateYmd,
    });
    const resolved = resolveDailyTopScorers(pointsByUid);

    const awardRes = await awardDailyTopBonus({
      groupId: pair.groupId,
      gameDateYmd: pair.gameDateYmd,
      winnerUids: resolved.winnerUids,
      topScore: resolved.topScore,
    });

    const pushRes = await notifyDailyTopScorer({
      groupId: pair.groupId,
      gameDateYmd: pair.gameDateYmd,
      winnerUids: resolved.winnerUids,
      topScore: resolved.topScore,
    });

    results.push({
      groupId: pair.groupId,
      gameDate: pair.gameDateYmd,
      sent: pushRes?.sent || 0,
      skipped: pushRes?.skipped || false,
      reason: pushRes?.reason || null,
      winnerUids: pushRes?.winnerUids || resolved.winnerUids,
      topScore: pushRes?.topScore ?? resolved.topScore,
      bonusAwarded: awardRes?.awarded || pushRes?.bonusAwarded || 0,
    });
  }

  console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
