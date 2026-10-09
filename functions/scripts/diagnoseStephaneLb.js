import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uid = "gVGxGYqXiIfycuvw42bGefKZlrF2";
const gid = "LcfHpQemisD0JXy5scuo";

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
  initializeApp(
    saPath ? { credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))) } : undefined
  );
}

const db = getFirestore();

const lbs = await db.collection(`groups/${gid}/leaderboards`).get();
console.log("leaderboard keys:", lbs.docs.map((d) => d.id));

for (const lb of lbs.docs) {
  const m = await db.doc(`groups/${gid}/leaderboards/${lb.id}/members/${uid}`).get();
  if (!m.exists) continue;
  const d = m.data();
  console.log("\n---", lb.id, "---");
  console.log(
    JSON.stringify(
      {
        pointsTotal: d.pointsTotal,
        tsPoints: d.tsPoints,
        fgcPoints: d.fgcPoints,
        tpPoints: d.tpPoints,
        families: d.families,
        winsByType: d.winsByType,
      },
      null,
      2
    )
  );
}

const membersSnap = await db
  .collection(`groups/${gid}/leaderboards/nhl_20252026_regular/members`)
  .get();
console.log("\n=== all members nhl_20252026_regular tsPoints ===");
for (const doc of membersSnap.docs) {
  const d = doc.data();
  console.log(doc.id.slice(0, 8), "ts", d.tsPoints, "fam", d.families?.ts?.points, "total", d.pointsTotal);
}

const defis = await db.collection("defis").where("groupId", "==", gid).get();
console.log("\n=== defi participations for uid ===");
for (const doc of defis.docs) {
  const defi = doc.data();
  const p = await doc.ref.collection("participations").doc(uid).get();
  if (!p.exists) continue;
  const pd = p.data();
  console.log(
    JSON.stringify({
      defiId: doc.id,
      status: defi.status,
      type: defi.type,
      gameDate: defi.gameDate,
      gameYmd: defi.gameYmd,
      finalPoints: pd.finalPoints,
      livePoints: pd.livePoints,
      payout: pd.payout,
      bonus: pd.bonus,
    })
  );
}
