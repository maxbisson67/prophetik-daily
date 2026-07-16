/**
 * Diagnostic classement pour un participant.
 * Usage: node scripts/diagnoseParticipantLeaderboard.js <uid>
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uid = String(process.argv[2] || "").trim();

if (!uid) {
  console.error("Usage: node scripts/diagnoseParticipantLeaderboard.js <uid>");
  process.exit(1);
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

if (!getApps().length) {
  const saPath = resolveServiceAccountPath();
  initializeApp(saPath ? { credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) } : undefined);
}

const db = getFirestore();

const participant = await db.doc(`participants/${uid}`).get();
console.log("=== participant ===");
console.log(JSON.stringify({ exists: participant.exists, ...(participant.data() || {}) }, null, 2));

const profile = await db.doc(`profiles_public/${uid}`).get();
console.log("\n=== profiles_public ===");
console.log(JSON.stringify({ exists: profile.exists, ...(profile.data() || {}) }, null, 2));

const memberships = await db.collection("group_memberships").where("uid", "==", uid).get();
console.log("\n=== group_memberships ===");
for (const d of memberships.docs) {
  console.log(JSON.stringify({ id: d.id, ...(d.data() || {}) }, null, 2));
}

const bundlesSnap = await db.collection("team_prediction_bundles").orderBy("gameYmd", "desc").limit(200).get();
const tpHits = [];

for (const b of bundlesSnap.docs) {
  const entry = await db.doc(`team_prediction_bundles/${b.id}/entries/${uid}`).get();
  if (!entry.exists) continue;
  const data = entry.data() || {};
  const pickResults = data.pickResults || {};
  const pointsFromResults = Object.values(pickResults).reduce(
    (sum, r) => sum + Number(r?.points || 0),
    0
  );
  tpHits.push({
    bundleId: b.id,
    groupId: b.data()?.groupId,
    gameYmd: b.data()?.gameYmd,
    status: b.data()?.status,
    totalPoints: data.totalPoints ?? null,
    pointsFromPickResults: pointsFromResults,
    pickResultsCount: Object.keys(pickResults).length,
  });
}

console.log("\n=== TP bundle entries (recent 200 bundles) ===");
console.log(JSON.stringify(tpHits, null, 2));

for (const m of memberships.docs) {
  const gid = String(m.data()?.groupId || "");
  if (!gid) continue;

  const group = await db.doc(`groups/${gid}`).get();
  const g = group.data() || {};
  console.log(`\n=== leaderboards for group ${gid} (${g.name}, sport=${g.sport || g.league}) ===`);

  const lbs = await db.collection(`groups/${gid}/leaderboards`).get();
  for (const lb of lbs.docs) {
    const member = await db.doc(`groups/${gid}/leaderboards/${lb.id}/members/${uid}`).get();
    if (!member.exists) continue;
    const d = member.data() || {};
    console.log(
      JSON.stringify(
        {
          competitionKey: lb.id,
          pointsTotal: d.pointsTotal,
          tpPoints: d.tpPoints,
          tpWins: d.tpWins,
          tpExactWins: d.tpExactWins,
          fgcPoints: d.fgcPoints,
          tsPoints: d.tsPoints,
          families: d.families,
        },
        null,
        2
      )
    );

    const allSnap = await db
      .collection(`groups/${gid}/leaderboards/${lb.id}/members`)
      .orderBy("pointsTotal", "desc")
      .get();
    const rows = allSnap.docs.map((doc, i) => ({
      rank: i + 1,
      id: doc.id,
      pointsTotal: doc.data()?.pointsTotal,
      tpPoints: doc.data()?.tpPoints ?? doc.data()?.families?.tp?.points,
    }));
    const thomasRow = rows.find((r) => r.id === uid);
    const top50Ids = rows.slice(0, 50).map((r) => r.id);
    console.log(
      JSON.stringify(
        {
          totalMembers: allSnap.size,
          thomasRankByPointsTotal: thomasRow?.rank ?? null,
          thomasInTop50ByPointsTotal: top50Ids.includes(uid),
          tpRank:
            [...rows]
              .sort((a, b) => Number(b.tpPoints || 0) - Number(a.tpPoints || 0))
              .findIndex((r) => r.id === uid) + 1 || null,
        },
        null,
        2
      )
    );
  }
}
