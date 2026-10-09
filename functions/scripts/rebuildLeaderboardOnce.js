/**
 * Rebuild leaderboard saison pour un groupe.
 *
 * Usage:
 *   cd functions && node scripts/rebuildLeaderboardOnce.js <groupId> [competitionKey] [fromYmd] [toYmd]
 *   ex: node scripts/rebuildLeaderboardOnce.js LcfHpQemisD0JXy5scuo nhl_20252026_regular 2025-10-07 2026-04-17
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

if (!getApps().length) {
  const saPath = resolveServiceAccountPath();
  if (!saPath) {
    console.error("Missing Firebase service account credentials.");
    process.exit(1);
  }
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) });
}

const groupId = String(process.argv[2] || "").trim();
const seasonId = String(process.argv[3] || "nhl_20252026_regular").trim();
const fromYmd = String(process.argv[4] || "2025-10-01").trim();
const toYmd = String(process.argv[5] || "2026-06-30").trim();

if (!groupId) {
  console.error("Usage: node scripts/rebuildLeaderboardOnce.js <groupId> [seasonId] [fromYmd] [toYmd]");
  process.exit(1);
}

const { rebuildLeaderboardSeasonForGroupLogic } = await import("../leaderboard/leaderboard.js");

const result = await rebuildLeaderboardSeasonForGroupLogic({
  groupId,
  seasonId,
  fromYmd,
  toYmd,
  clearDirty: true,
});

console.log(JSON.stringify({ ok: true, ...result }, null, 2));
