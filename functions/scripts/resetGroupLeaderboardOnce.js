/**
 * Remet à zéro le classement saison d'un groupe (docs members supprimés).
 * Ne touche pas aux défis, participations, streaks ni crédits.
 *
 * Usage:
 *   cd functions
 *   node scripts/resetGroupLeaderboardOnce.js --groupId=<gid> [--dry-run]
 *   node scripts/resetGroupLeaderboardOnce.js --groupId=<gid> --competitionKey=nhl_20252026_regular --execute
 *   node scripts/resetGroupLeaderboardOnce.js --groupId=<gid> --execute --clear-finalize-meta
 *
 * Par défaut : --dry-run (aucune écriture). --execute requis pour supprimer.
 *
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS, scripts/serviceAccountKey.json,
 *   ou ../capitaine-firebase-adminsdk-*.json à la racine du projet.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { appYmd } from "../ProphetikDate.js";
import { resolveCompetitionForGroup } from "../leaderboard/seasonCompetitions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_SIZE = 400;

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
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

function initAdmin() {
  if (getApps().length) return;
  const saPath = resolveServiceAccountPath();
  if (saPath) {
    initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
    });
    return;
  }
  initializeApp();
}

async function deleteCollection(ref, { dryRun }) {
  const deleted = [];
  let snap = await ref.limit(BATCH_SIZE).get();
  while (!snap.empty) {
    if (!dryRun) {
      const batch = getFirestore().batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    deleted.push(...snap.docs.map((d) => d.ref.path));
    snap = await ref.limit(BATCH_SIZE).get();
  }
  return deleted;
}

async function main() {
  const groupId = String(readArg("groupId") || process.argv[2] || "").trim();
  const competitionKeyArg = String(readArg("competitionKey") || "").trim();
  const dryRun = !hasFlag("execute");
  const clearFinalizeMeta = hasFlag("clear-finalize-meta");
  const clearSummary = hasFlag("clear-summary");
  const todayYmd = String(readArg("today") || appYmd(new Date())).slice(0, 10);

  if (!groupId) {
    console.error(
      "Usage: node scripts/resetGroupLeaderboardOnce.js --groupId=<gid> [--competitionKey=...] [--dry-run|--execute]"
    );
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore();

  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) {
    console.error(JSON.stringify({ ok: false, reason: "group-not-found", groupId }, null, 2));
    process.exit(1);
  }

  const group = groupSnap.data() || {};
  let competitionKey = competitionKeyArg;
  let competitionLabel = null;

  if (!competitionKey) {
    const comp = await resolveCompetitionForGroup({
      db,
      groupId,
      gameYmd: todayYmd,
    });
    if (!comp?.competitionKey) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            reason: "no-active-competition",
            groupId,
            todayYmd,
            hint: "Pass --competitionKey= explicitly",
          },
          null,
          2
        )
      );
      process.exit(1);
    }
    competitionKey = comp.competitionKey;
    competitionLabel = comp.label || null;
  }

  const membersRef = db.collection(
    `groups/${groupId}/leaderboards/${competitionKey}/members`
  );
  const membersSnap = await membersRef.get();
  const preview = membersSnap.docs
    .map((d) => {
      const x = d.data() || {};
      return {
        uid: d.id,
        displayName: x.displayName || null,
        pointsTotal: x.pointsTotal ?? 0,
        participations: x.participations ?? 0,
        fgcWins: x.fgcWins ?? x.families?.fgc?.wins ?? 0,
        tpWins: x.tpWins ?? 0,
        tsWins: x.tsWins ?? 0,
      };
    })
    .sort((a, b) => Number(b.pointsTotal) - Number(a.pointsTotal));

  const metaRef = db.doc(`groups/${groupId}/leaderboards/${competitionKey}`);
  const metaSnap = await metaRef.get();
  const meta = metaSnap.data() || {};

  const plan = {
    ok: true,
    dryRun,
    groupId,
    groupName: group.name || group.displayName || null,
    sport: group.sport || "NHL",
    competitionKey,
    competitionLabel,
    todayYmd,
    membersCount: membersSnap.size,
    membersPreview: preview.slice(0, 20),
    meta: {
      exists: metaSnap.exists,
      winnerDeclaredAt: meta.winnerDeclaredAt || null,
      winnerUids: meta.winnerUids || null,
      status: meta.status || null,
    },
    actions: {
      deleteMemberPaths: membersSnap.size,
      clearFinalizeMeta,
      clearSummary,
    },
  };

  if (dryRun) {
    plan.note =
      "Dry-run only. Re-run with --execute to delete members (and optional meta/summary clears).";
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const deletedPaths = await deleteCollection(membersRef, { dryRun: false });

  const writes = { membersDeleted: deletedPaths.length };

  if (clearFinalizeMeta && metaSnap.exists) {
    await metaRef.set(
      {
        winnerUids: FieldValue.delete(),
        winnerPoints: FieldValue.delete(),
        winnerDeclaredAt: FieldValue.delete(),
        status: "active",
        membersCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    writes.clearedFinalizeMeta = true;
  }

  if (clearSummary) {
    const summaryRef = db.doc(
      `groups/${groupId}/leaderboards/${competitionKey}/stats/summary`
    );
    const summarySnap = await summaryRef.get();
    if (summarySnap.exists) {
      await summaryRef.delete();
      writes.deletedSummary = true;
    }
  }

  console.log(
    JSON.stringify(
      {
        ...plan,
        dryRun: false,
        deletedMemberPaths: deletedPaths.length,
        writes,
        warning:
          "Participations on past defis unchanged; rebuildLeaderboardOnce on this window would restore aggregates.",
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
