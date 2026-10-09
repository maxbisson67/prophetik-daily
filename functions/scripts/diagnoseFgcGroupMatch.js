/**
 * Usage: node scripts/diagnoseFgcGroupMatch.js <groupId> [away] [home]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const groupId = process.argv[2];
const awayFilter = String(process.argv[3] || "NSH").toUpperCase();
const homeFilter = String(process.argv[4] || "MTL").toUpperCase();

if (!groupId) {
  console.error("Usage: node scripts/diagnoseFgcGroupMatch.js <groupId> [away] [home]");
  process.exit(1);
}

const saPath = resolveServiceAccountPath();
if (!getApps().length) {
  if (!saPath) {
    console.error("No service account found");
    process.exit(1);
  }
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) });
}

const db = getFirestore();

const snap = await db.collection("first_goal_challenges").where("groupId", "==", groupId).get();

const matches = [];
for (const doc of snap.docs) {
  const d = doc.data() || {};
  const away = String(d.awayAbbr || "").toUpperCase();
  const home = String(d.homeAbbr || "").toUpperCase();
  const isMatch =
    (away === awayFilter && home === homeFilter) ||
    (away === homeFilter && home === awayFilter);
  if (!isMatch) continue;

  const entriesSnap = await doc.ref.collection("entries").get();
  const entries = entriesSnap.docs.map((e) => ({ uid: e.id, ...e.data() }));

  matches.push({
    challengeId: doc.id,
    gameYmd: d.gameYmd,
    status: d.status,
    payoutTotal: d.payoutTotal,
    winnerShares: d.winnerShares,
    payoutApplied: d.payoutApplied,
    payoutAppliedAt: d.payoutAppliedAt?.toDate?.()?.toISOString?.() || null,
    leaderboardLiveAppliedAt: d.leaderboardLiveAppliedAt?.toDate?.()?.toISOString?.() || null,
    firstGoal: d.firstGoal,
    winnersPreviewUids: d.winnersPreviewUids,
    stakePoints: d.stakePoints,
    points: d.points,
    potJoinIncrement: d.potJoinIncrement,
    entries: entries.map((e) => ({
      uid: e.uid || e.id,
      displayName: e.displayName,
      playerId: e.playerId,
      playerName: e.playerName,
      won: e.won,
      payout: e.payout,
      points: e.points,
    })),
  });
}

matches.sort((a, b) => String(b.gameYmd).localeCompare(String(a.gameYmd)));
console.log(JSON.stringify({ groupId, awayFilter, homeFilter, matchCount: matches.length, matches }, null, 2));

const compSnap = await db.collection(`groups/${groupId}/leaderboards`).get();
const compIds = compSnap.docs.map((d) => d.id);
console.log("\nLeaderboard season keys:", compIds);

for (const m of matches) {
  for (const e of m.entries) {
    if (!(e.won || (e.payout ?? 0) > 0 || (e.points ?? 0) > 0)) continue;
    for (const sid of compIds) {
      const mem = await db.doc(`groups/${groupId}/leaderboards/${sid}/members/${e.uid}`).get();
      if (!mem.exists) continue;
      const md = mem.data() || {};
      console.log("\nMember", e.displayName || e.uid, "uid", e.uid, "season", sid, {
        fgcPoints: md.fgcPoints,
        fgcWins: md.fgcWins,
        dailyBonusPoints: md.dailyBonusPoints,
        dailyBonusWins: md.dailyBonusWins,
        pointsTotal: md.pointsTotal,
      });
    }
  }
}
