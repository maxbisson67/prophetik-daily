import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gid = String(process.argv[2] || "").trim();

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
if (!gid) {
  console.error("Usage: node scripts/diagnoseGroupLeaderboard.js <groupId>");
  process.exit(1);
}

const group = await db.doc(`groups/${gid}`).get();
console.log("group:", group.data()?.name, gid);

const lbs = await db.collection(`groups/${gid}/leaderboards`).get();
console.log("leaderboard keys:", lbs.docs.map((d) => d.id));

for (const lb of lbs.docs) {
  const members = await db.collection(`groups/${gid}/leaderboards/${lb.id}/members`).get();
  console.log(`\n=== ${lb.id} (${members.size} members) ===`);
  const rows = members.docs
    .map((d) => {
      const x = d.data() || {};
      return {
        id: d.id.slice(0, 8),
        total: x.pointsTotal,
        ts: x.tsPoints ?? x.families?.ts?.points,
        tp: x.tpPoints,
        fgc: x.fgcPoints,
        tsPlays: x.tsPlays ?? x.families?.ts?.plays,
      };
    })
    .sort((a, b) => Number(b.total) - Number(a.total));
  console.table(rows);
}

const defis = await db.collection("defis").where("groupId", "==", gid).get();
console.log("\ndefis:", defis.size, "completed:", defis.docs.filter((d) => d.data()?.status === "completed").length);
