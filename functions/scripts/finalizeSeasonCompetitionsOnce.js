/**
 * Force la clôture des compétitions expirées (grace days inclus).
 *
 * Usage:
 *   node functions/scripts/finalizeSeasonCompetitionsOnce.js
 *   node functions/scripts/finalizeSeasonCompetitionsOnce.js --today=2026-04-20
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { runFinalizeSeasonCompetitions } from "../leaderboard/finalizeSeasonCompetitions.js";
import { appYmd } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();

const argToday = process.argv.find((a) => a.startsWith("--today="));
const todayYmd = argToday ? argToday.split("=")[1] : appYmd(new Date());

const out = await runFinalizeSeasonCompetitions({ todayYmd, graceDays: 2 });
console.log(JSON.stringify(out, null, 2));
