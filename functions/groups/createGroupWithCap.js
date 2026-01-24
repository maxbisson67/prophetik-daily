// functions/createGroupWithCap.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

function generateCodeInvitation(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
  let code = "";
  for (let i = 0; i < length; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function getLimits(mode) {
  if (mode === "vip") return { owner: 25, member: 50 };
  if (mode === "pro") return { owner: 5, member: 10 };
  return { owner: 1, member: 1 };
}

function normalizeTier(tier, active) {
  const t = String(tier || "free").toLowerCase();
  const normalized = t === "vip" ? "vip" : t === "pro" ? "pro" : "free";
  return active === false ? "free" : normalized;
}

async function readUserPlan(uid) {
  const snap = await db.doc(`entitlements/${uid}`).get();
  if (!snap.exists) return { tier: "free", active: true, mode: "free" };

  const d = snap.data() || {};
  const tier = normalizeTier(d.tier, d.active);
  return { tier, active: d.active !== false, mode: tier };
}

/**
 * Compte les memberships actifs pour un role précis.
 * role: "owner" | "member"
 */
async function countMembershipsByRole({ uid, role, limitPlusOne }) {
  const q = await db
    .collection("group_memberships")
    .where("uid", "==", String(uid))
    .where("active", "==", true)
    .where("role", "==", String(role))
    .limit(limitPlusOne)
    .get();

  return q.size;
}

export const createGroupWithCap = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Not authenticated");

  const name = String(req.data?.name || "").trim();
  const description = String(req.data?.description || "").trim();
  if (!name) throw new HttpsError("invalid-argument", "Missing name");

  const { mode } = await readUserPlan(uid);
  const limits = getLimits(mode);

  // ✅ CAP OWNER basé sur role="owner"
  const ownerCount = await countMembershipsByRole({
    uid,
    role: "owner",
    limitPlusOne: limits.owner + 1,
  });

  if (ownerCount >= limits.owner) {
    throw new HttpsError("failed-precondition", "OWNER_GROUP_LIMIT_REACHED", {
      current: ownerCount,
      max: limits.owner,
      mode,
    });
  }

  // profil participant (optionnel, pour ownerName/avatar)
  const pSnap = await db.doc(`participants/${uid}`).get();
  const p = pSnap.exists ? pSnap.data() || {} : {};
  const displayName =
    p.displayName || (p.email ? String(p.email).split("@")[0] : "") || "Guest";
  const avatarUrl = p.photoURL || p.avatarUrl || null;

  const groupRef = db.collection("groups").doc();
  const groupId = groupRef.id;
  const codeInvitation = generateCodeInvitation(8);
  const gmRef = db.doc(`group_memberships/${groupId}_${uid}`);

  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.set(groupRef, {
      name,
      description,
      avatarUrl: null,
      codeInvitation,

      createdBy: uid,
      ownerId: uid,
      ownerName: displayName,
      ownerAvatarUrl: avatarUrl || null,

      isPrivate: true,
      status: "active",
      active: true,

      createdAt: now,
      updatedAt: now,
    });

    tx.set(gmRef, {
      groupId,
      uid,
      userId: uid, // ✅ cohérent avec tes docs existants
      role: "owner",
      // isOwner: true, // (optionnel) tu peux garder pour legacy, mais plus utilisé
      active: true,
      status: "active",
      displayName,
      avatarUrl: avatarUrl || null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { groupId, codeInvitation };
});