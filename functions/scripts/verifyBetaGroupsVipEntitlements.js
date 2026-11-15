/**
 * Vérifie que les membres humains des groupes pilotes ont un entitlement VIP actif.
 *
 *   cd functions
 *   node scripts/verifyBetaGroupsVipEntitlements.js
 *   node scripts/verifyBetaGroupsVipEntitlements.js --participating-only
 *   node scripts/verifyBetaGroupsVipEntitlements.js --groupIds=gid1,gid2
 *
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS, scripts/serviceAccountKey.json,
 *   ou ../capitaine-firebase-adminsdk-*.json à la racine du projet.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { isActiveMembership } from "../groups/groupMembership.js";
import {
  isNovaMember,
  isParticipatingMember,
} from "../groups/participationUtils.js";
import { normalizePlanTier } from "../subscriptions/planLimits.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PILOT_GROUP_IDS = [
  "ovkcdDpAAKRwWSQQFUh7",
  "LcfHpQemisD0JXy5scuo",
  "PKe3Nz5Nu3UtwxuCANpm",
  "VmbZYoAMM9nRkgBBvQUE",
];

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function collectGroupIds() {
  const fromList = argValue("--groupIds");
  if (fromList) {
    return fromList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...PILOT_GROUP_IDS];
}

function initAdmin() {
  if (getApps().length) return;
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../capitaine-firebase-adminsdk-fbsvc-a0066fa0df.json"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      initializeApp({ credential: cert(JSON.parse(fs.readFileSync(c, "utf8"))) });
      return;
    }
  }
  initializeApp();
}

function memberUid(data = {}) {
  return String(data.uid || data.userId || data.participantId || "").trim();
}

function effectiveEntitlement(ent = {}) {
  const tier = normalizePlanTier(ent.tier, ent.active !== false);
  const rawTier = String(ent.tier || "free").toLowerCase();
  const active = ent.active === true;
  return {
    tier,
    rawTier,
    active,
    source: String(ent.source || ""),
    isVip: tier === "vip",
  };
}

async function loadGroupMembers(db, groupId, { participatingOnly }) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get();

  const rows = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const uid = memberUid(data);
    if (!uid || isNovaMember(data, uid)) continue;
    if (!isActiveMembership(data)) continue;
    if (participatingOnly && !isParticipatingMember(data)) continue;

    rows.push({
      uid,
      displayName: String(data.displayName || data.name || "").trim() || uid,
      role: String(data.role || "member"),
      participation: String(data.participation || ""),
    });
  }

  return rows;
}

async function loadEntitlement(db, uid) {
  const snap = await db.doc(`entitlements/${uid}`).get();
  if (!snap.exists) {
    return {
      exists: false,
      tier: "free",
      rawTier: "—",
      active: false,
      source: "",
      isVip: false,
    };
  }
  const eff = effectiveEntitlement(snap.data() || {});
  return { exists: true, ...eff };
}

async function main() {
  const participatingOnly = hasFlag("participating-only");
  const groupIds = collectGroupIds();
  initAdmin();
  const db = getFirestore();

  const byGroup = [];
  const globalMembers = new Map();

  for (const groupId of groupIds) {
    const gSnap = await db.doc(`groups/${groupId}`).get();
    const gName = gSnap.exists
      ? String(gSnap.data()?.name || gSnap.data()?.title || groupId)
      : groupId;

    const members = await loadGroupMembers(db, groupId, { participatingOnly });
    const checked = [];

    for (const m of members) {
      const ent = await loadEntitlement(db, m.uid);
      const row = {
        ...m,
        entitlement: ent,
        ok: ent.isVip,
      };
      checked.push(row);

      if (!globalMembers.has(m.uid)) {
        globalMembers.set(m.uid, {
          uid: m.uid,
          displayName: m.displayName,
          groups: [],
          entitlement: ent,
          ok: ent.isVip,
        });
      }
      const gRow = globalMembers.get(m.uid);
      gRow.groups.push({ groupId, groupName: gName });
      if (!ent.isVip) gRow.ok = false;
      if (ent.exists) {
        gRow.entitlement = ent;
      }
    }

    const notVip = checked.filter((r) => !r.ok);
    byGroup.push({
      groupId,
      groupName: gName,
      exists: gSnap.exists,
      membersChecked: checked.length,
      vipCount: checked.length - notVip.length,
      notVipCount: notVip.length,
      notVip,
      members: checked,
    });
  }

  const allHumans = [...globalMembers.values()];
  const notVipGlobal = allHumans.filter((r) => !r.ok);

  const summary = {
    ok: notVipGlobal.length === 0,
    participatingOnly,
    groupIds,
    groups: byGroup.map((g) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      exists: g.exists,
      membersChecked: g.membersChecked,
      vipCount: g.vipCount,
      notVipCount: g.notVipCount,
      notVip: g.notVip.map((r) => ({
        uid: r.uid,
        displayName: r.displayName,
        tier: r.entitlement.tier,
        rawTier: r.entitlement.rawTier,
        active: r.entitlement.active,
        source: r.entitlement.source,
        exists: r.entitlement.exists,
      })),
    })),
    uniqueHumans: allHumans.length,
    uniqueVip: allHumans.length - notVipGlobal.length,
    uniqueNotVip: notVipGlobal.length,
    uniqueNotVipList: notVipGlobal.map((r) => ({
      uid: r.uid,
      displayName: r.displayName,
      groups: r.groups,
      tier: r.entitlement.tier,
      rawTier: r.entitlement.rawTier,
      active: r.entitlement.active,
      source: r.entitlement.source,
      exists: r.entitlement.exists,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});