/**
 * Corrige un match FGC NHL sans premier but valide (ex. but refusé, 0-0 + SO).
 *
 * Usage:
 *   cd functions
 *   node scripts/fixFgcGameNoFirstGoal.js 2026020075
 *   node scripts/fixFgcGameNoFirstGoal.js --ymd=2026-10-10 --away=DET --home=MTL
 *   node scripts/fixFgcGameNoFirstGoal.js 2026020075 --apply
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function resolveServiceAccountPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../../serviceAccount.json"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function resolveGameId(db) {
  const positional = process.argv.filter((a) => !a.startsWith("-"));
  const direct = String(positional[2] || "").trim();
  if (direct) return direct;

  const ymd = readArg("ymd");
  const away = String(readArg("away") || "").toUpperCase();
  const home = String(readArg("home") || "").toUpperCase();
  if (!ymd || !away || !home) {
    return null;
  }

  for (const field of ["ymd", "date"]) {
    const snap = await db.collection("nhl_live_games").where(field, "==", ymd).get();
    for (const doc of snap.docs) {
      const d = doc.data() || {};
      const a = String(d.awayAbbr || "").toUpperCase();
      const h = String(d.homeAbbr || "").toUpperCase();
      if ((a === away && h === home) || (a === home && h === away)) {
        return doc.id;
      }
    }
  }
  return null;
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
const { repairNhlFirstGoalTerminalGame } = await import(
  "../firstGoalChallenge/repairNhlFirstGoalTerminal.js"
);

const gameId = await resolveGameId(db);
if (!gameId) {
  console.error("Usage: node scripts/fixFgcGameNoFirstGoal.js <gameId> [--apply]");
  console.error("   or: node scripts/fixFgcGameNoFirstGoal.js --ymd=YYYY-MM-DD --away=DET --home=MTL [--apply]");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const forceNoWinner = process.argv.includes("--force");

const preview = await repairNhlFirstGoalTerminalGame(gameId, {
  forceNoWinner,
  revertChallenges: true,
  dryRun: true,
  reason: "dry-run",
});

if (!apply) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        gameId,
        preview,
        message: "Re-run with --apply to write Firestore + revert payouts",
      },
      null,
      2
    )
  );
  process.exit(0);
}

const result = await repairNhlFirstGoalTerminalGame(gameId, {
  forceNoWinner: forceNoWinner || true,
  revertChallenges: true,
  reason: "manual-no-first-goal",
});

console.log(JSON.stringify({ ok: true, dryRun: false, gameId, result }, null, 2));
