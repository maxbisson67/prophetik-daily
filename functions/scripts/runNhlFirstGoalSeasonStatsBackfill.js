/**
 * Backfill premiers buts saison (batch local, plusieurs passes si stoppedAtMax).
 *
 * node scripts/runNhlFirstGoalSeasonStatsBackfill.js
 * node scripts/runNhlFirstGoalSeasonStatsBackfill.js --max=100
 * node scripts/runNhlFirstGoalSeasonStatsBackfill.js --from=2026-10-07 --seasonId=20262027 --max=100
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  rebuildNhlFirstGoalSeasonCountsFromProcessed,
  runBackfillNhlFirstGoalSeasonStats,
} from "../nhl/nhlFirstGoalSeasonStatsCore.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.split("=").slice(1).join("=") || fallback;
}

const fromYmd = arg("from");
const toYmd = arg("to");
const maxGames = Number(arg("max", "80"));
const dryRun = process.argv.includes("--dryRun");
const rebuildOnly = process.argv.includes("--rebuildCounts");

if (rebuildOnly) {
  const seasonId = arg("seasonId");
  const rebuilt = await rebuildNhlFirstGoalSeasonCountsFromProcessed(db, seasonId);
  console.log(JSON.stringify(rebuilt, null, 2));
  process.exit(0);
}

const stats = await runBackfillNhlFirstGoalSeasonStats(db, {
  fromYmdDashed: fromYmd,
  toYmdDashed: toYmd,
  maxGames,
  dryRun,
});

console.log(JSON.stringify(stats, null, 2));

if (stats.stoppedAtMax) {
  console.log("\nRelance le script jusqu'à stoppedAtMax=false.");
  process.exit(0);
}
