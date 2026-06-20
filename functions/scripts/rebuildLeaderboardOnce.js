/**
 * Rebuild leaderboard saison pour un groupe.
 *
 * Usage:
 *   cd functions && node scripts/rebuildLeaderboardOnce.js WxGjajTBv3aGloLmBEmW
 */
import { rebuildLeaderboardSeasonForGroupLogic } from "../leaderboard/leaderboard.js";

const groupId = String(process.argv[2] || "").trim();
const seasonId = String(process.argv[3] || "20252026").trim();
const fromYmd = String(process.argv[4] || "2025-10-01").trim();
const toYmd = String(process.argv[5] || "2026-06-30").trim();

if (!groupId) {
  console.error("Usage: node scripts/rebuildLeaderboardOnce.js <groupId> [seasonId] [fromYmd] [toYmd]");
  process.exit(1);
}

const result = await rebuildLeaderboardSeasonForGroupLogic({
  groupId,
  seasonId,
  fromYmd,
  toYmd,
  clearDirty: true,
});

console.log(JSON.stringify({ ok: true, ...result }, null, 2));
