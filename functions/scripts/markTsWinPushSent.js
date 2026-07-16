/**
 * Marque groupWinPushSentAt sur les TS d'un groupe+jour sans renvoyer de push.
 * Utile après une rafale de notifications (catchup 14 jours).
 *
 * Usage:
 *   node functions/scripts/markTsWinPushSent.js --groupName=beaudry
 *   node functions/scripts/markTsWinPushSent.js --groupId=abc --date=2026-07-09
 *   node functions/scripts/markTsWinPushSent.js --all-groups --days=14
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { markTsWinPushSentForGroupDay } from "../notifications/notifyChallengeWin.js";
import { appYmd, addDaysToYmd } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function findGroupIdByName(nameNeedle) {
  const needle = String(nameNeedle || "").trim().toLowerCase();
  if (!needle) return null;

  const snap = await db.collection("groups").get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const name = String(data.name || data.title || "").toLowerCase();
    if (name.includes(needle)) return doc.id;
  }
  return null;
}

function groupDayKey(groupId, gameDate) {
  return `${String(groupId || "").trim()}|${String(gameDate || "").slice(0, 10)}`;
}

async function main() {
  const groupIdArg = readArg("groupId");
  const groupNameArg = readArg("groupName");
  const dateArg = readArg("date");
  const days = Math.max(1, Number(readArg("days") || 14) || 14);
  const allGroups = hasFlag("all-groups");

  let groupId = groupIdArg;
  if (!groupId && groupNameArg) {
    groupId = await findGroupIdByName(groupNameArg);
  }

  const today = appYmd(new Date());
  const fromYmd = dateArg || addDaysToYmd(today, -days);
  const toYmd = dateArg || addDaysToYmd(today, -1);

  let q = db
    .collection("defis")
    .where("type", "==", 3)
    .where("gameDate", ">=", fromYmd)
    .where("gameDate", "<=", toYmd);

  if (groupId) {
    q = q.where("groupId", "==", String(groupId));
  } else if (!allGroups) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "missing-group",
          hint: "Use --groupId, --groupName=beaudry, or --all-groups",
        },
        null,
        2
      )
    );
    return;
  }

  const snap = await q.get();
  const pairs = new Map();

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const gid = String(data.groupId || "").trim();
    const ymd = String(data.gameDate || data.gameYmd || "").slice(0, 10);
    if (!gid || !ymd) continue;

    const key = groupDayKey(gid, ymd);
    if (!pairs.has(key)) {
      pairs.set(key, { groupId: gid, gameDateYmd: ymd, defiIds: [] });
    }
    pairs.get(key).defiIds.push(doc.id);
  }

  const results = [];
  for (const { groupId: gid, gameDateYmd, defiIds } of pairs.values()) {
    const res = await markTsWinPushSentForGroupDay({
      groupId: gid,
      gameDateYmd,
      primaryDefiId: defiIds[0] || null,
    });
    results.push({
      groupId: gid,
      gameDate: gameDateYmd,
      defiCount: defiIds.length,
      marked: res.marked,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        fromYmd,
        toYmd,
        groupDayCount: results.length,
        results,
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
