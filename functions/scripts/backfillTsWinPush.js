/**
 * Rattrapage des notifications TS gagnées (groupWinPushSentAt absent).
 *
 * Usage:
 *   node functions/scripts/backfillTsWinPush.js
 *   node functions/scripts/backfillTsWinPush.js --date=2026-07-08
 *   node functions/scripts/backfillTsWinPush.js --groupId=abc123
 *   node functions/scripts/backfillTsWinPush.js --defiId=20260708_3x3_abc
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { notifyTsWinners } from "../notifications/notifyChallengeWin.js";
import { appYmd, addDaysToYmd } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

function readArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

function normalizeUidArray(v) {
  const arr = Array.isArray(v) ? v : [];
  return arr.map((x) => String(x || "").trim()).filter(Boolean);
}

function groupDayKey(groupId, gameDate) {
  return `${String(groupId || "").trim()}|${String(gameDate || "").slice(0, 10)}`;
}

function pickPrimaryTsDefi(docs = []) {
  if (!docs.length) return null;
  const ranked = [...docs].sort((a, b) => {
    const potA = Number(a.data()?.pot ?? 0) || 0;
    const potB = Number(b.data()?.pot ?? 0) || 0;
    if (potB !== potA) return potB - potA;
    return String(a.id).localeCompare(String(b.id));
  });
  return ranked[0];
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

async function main() {
  const defiIdArg = readArg("defiId");
  const groupIdArg = readArg("groupId");
  const groupNameArg = readArg("groupName") || "beaudry";
  const dateArg = readArg("date") || addDaysToYmd(appYmd(new Date()), -1);

  let defiDocs = [];

  if (defiIdArg) {
    const snap = await db.doc(`defis/${defiIdArg}`).get();
    if (!snap.exists) {
      console.log(JSON.stringify({ ok: false, reason: "defi-not-found", defiId: defiIdArg }, null, 2));
      return;
    }
    defiDocs = [snap];
  } else {
    let groupId = groupIdArg;
    if (!groupId) {
      groupId = await findGroupIdByName(groupNameArg);
    }

    let q = db
      .collection("defis")
      .where("type", "==", 3)
      .where("gameDate", "==", dateArg);

    if (groupId) {
      q = q.where("groupId", "==", groupId);
    }

    const snap = await q.get();
    defiDocs = snap.docs;

    if (!defiDocs.length && groupId) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            reason: "no-ts-defi",
            groupId,
            gameDate: dateArg,
          },
          null,
          2
        )
      );
      return;
    }
  }

  const results = [];
  const byGroupDay = new Map();

  for (const doc of defiDocs) {
    const data = doc.data() || {};
    const groupId = String(data.groupId || "").trim();
    const gameDate = String(data.gameDate || data.gameYmd || "").slice(0, 10);
    if (!groupId || !gameDate) continue;

    const key = groupDayKey(groupId, gameDate);
    if (!byGroupDay.has(key)) byGroupDay.set(key, []);
    byGroupDay.get(key).push(doc);
  }

  for (const docs of byGroupDay.values()) {
    const primary = pickPrimaryTsDefi(docs);
    if (!primary) continue;

    const data = primary.data() || {};
    const defiId = primary.id;
    const groupId = String(data.groupId || "").trim();
    const winners = normalizeUidArray(data.winners);

    if (!groupId || !winners.length) {
      results.push({
        defiId,
        groupId: groupId || null,
        skipped: true,
        reason: !groupId ? "missing-group" : "no-winners",
        siblingDefiIds: docs.map((d) => d.id).filter((id) => id !== defiId),
      });
      continue;
    }

    if (data.groupWinPushSentAt) {
      results.push({
        defiId,
        groupId,
        skipped: true,
        reason: "already-sent",
        groupWinPushSentAt: data.groupWinPushSentAt,
        siblingDefiIds: docs.map((d) => d.id).filter((id) => id !== defiId),
      });
      continue;
    }

    const pushRes = await notifyTsWinners({
      defiId,
      groupId,
      winnerUids: winners,
    });

    results.push({
      defiId,
      groupId,
      gameDate: String(data.gameDate || data.gameYmd || "").slice(0, 10),
      winners,
      sent: pushRes?.sent || 0,
      skipped: pushRes?.skipped || false,
      reason: pushRes?.reason || null,
      siblingDefiIds: docs.map((d) => d.id).filter((id) => id !== defiId),
    });
  }

  console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
