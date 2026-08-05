import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  awardDailyTopBonus,
  computeDailyGroupPoints,
  resolveDailyTopScorers,
} from "../notifications/dailyTopScorer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
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

const groupId = readArg("groupId") || "xGjajTBv3aGloLmBEmW";
const gameDate = (readArg("date") || "2026-07-26").slice(0, 10);
const uid = readArg("uid") || "Bvuy3cwtnyLZqcyNje124mWKcqB2";
const apply = process.argv.includes("--apply");

async function listGroupChallenges(gid, ymd, ymdCompact) {
  const [tsSnap, fgcSnap, tpSnap] = await Promise.all([
    db.collection("defis").where("groupId", "==", gid).where("type", "==", 3).get(),
    db.collection("first_goal_challenges").where("groupId", "==", gid).get(),
    db.collection("team_prediction_bundles").where("groupId", "==", gid).get(),
  ]);

  return {
    ts: tsSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => {
        const d = row.gameDate || row.gameYmd;
        return String(d).includes(ymd.slice(5)) || String(d).includes(ymdCompact.slice(4));
      }),
    fgc: fgcSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => String(row.gameYmd || "").includes(ymd.slice(5)) || String(row.gameYmd || "").includes(ymdCompact.slice(4))),
    tp: tpSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((row) => String(row.gameYmd || "").includes(ymdCompact.slice(4)) || String(row.gameYmd || "").includes(ymd.slice(5))),
  };
}

async function main() {
  const ymdCompact = gameDate.replace(/-/g, "");
  const awardSnap = await db.doc(`groups/${groupId}/daily_bonus_awards/${gameDate}`).get();
  const pushSnap = await db.doc(`groups/${groupId}/daily_top_scorer_pushes/${gameDate}`).get();

  const { pointsByUid } = await computeDailyGroupPoints({ groupId, gameDateYmd: gameDate });
  const resolved = resolveDailyTopScorers(pointsByUid);
  const challenges = await listGroupChallenges(groupId, gameDate, ymdCompact);

  const out = {
    groupId,
    gameDate,
    uid,
    award: awardSnap.exists ? awardSnap.data() : null,
    push: pushSnap.exists ? pushSnap.data() : null,
    computed: resolved,
    breakdown: Object.fromEntries(
      [...pointsByUid.entries()].map(([id, stats]) => [id, stats])
    ),
    challenges: {
      ts: challenges.ts.map(({ id, gameDate, gameYmd, status, type }) => ({
        id,
        gameDate,
        gameYmd,
        status,
        type,
      })),
      fgc: challenges.fgc.map(({ id, gameYmd, status, winnersPreviewUids }) => ({
        id,
        gameYmd,
        status,
        winnersPreviewUids,
      })),
      tp: challenges.tp.map(({ id, gameYmd, status, payoutApplied }) => ({
        id,
        gameYmd,
        status,
        payoutApplied,
      })),
    },
  };

  if (apply) {
    out.applyResult = await awardDailyTopBonus({
      groupId,
      gameDateYmd: gameDate,
      winnerUids: resolved.winnerUids,
      topScore: resolved.topScore,
    });
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
