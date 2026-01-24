import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "../utils.js";

function normalizeTier(tier, active) {
  const t = String(tier || "free").toLowerCase();
  const normalized = t === "vip" ? "vip" : t === "pro" ? "pro" : "free";
  return active === false ? "free" : normalized;
}

function getCaps(tier) {
  if (tier === "vip") return { owner: 25, member: 50 };
  if (tier === "pro") return { owner: 5, member: 10 };
  return { owner: 1, member: 1 };
}

async function readEntitlementTier(uid) {
  const snap = await db.doc(`entitlements/${uid}`).get();
  if (!snap.exists) return "free";
  const d = snap.data() || {};
  return normalizeTier(d.tier, d.active);
}

async function countByRole(uid, role, limitPlusOne) {
  const q = await db
    .collection("group_memberships")
    .where("uid", "==", String(uid))
    .where("active", "==", true)
    .where("role", "==", String(role))
    .limit(limitPlusOne)
    .get();
  return q.size;
}

export const joinGroupWithCap = onCall(async (req) => {
  try {
    const uid = req.auth?.uid || null;
    if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

    const raw = String(req.data?.code ?? "").trim();
    if (!raw) throw new HttpsError("invalid-argument", "code required");

    const upper = raw.toUpperCase();
    const cleaned = upper.replace(/[^A-Z0-9]/g, "");
    const candidates = Array.from(new Set([raw, upper, cleaned])).filter(Boolean);

    // Find group by codeInvitation
    let snap = null;
    for (const c of candidates) {
      const q = await db.collection("groups").where("codeInvitation", "==", c).limit(1).get();
      if (!q.empty) {
        snap = q.docs[0];
        break;
      }
    }
    if (!snap) throw new HttpsError("not-found", "Invalid code");

    const groupId = snap.id;
    const membershipId = `${groupId}_${uid}`;
    const membershipRef = db.collection("group_memberships").doc(membershipId);

    // ✅ Si membership déjà active => OK, pas de cap, juste “touch” updatedAt + retour
    const existing = await membershipRef.get();
    if (existing.exists) {
      const ex = existing.data() || {};
      if (ex.active === true && String(ex.status || "active").toLowerCase() === "active") {
        const now = FieldValue.serverTimestamp();
        await membershipRef.set({ updatedAt: now }, { merge: true });
        await db.doc(`groups/${groupId}`).set({ updatedAt: now }, { merge: true });

        const g = snap.data() || {};
        return { ok: true, groupId, groupName: g.name ?? null, alreadyMember: true };
      }
    }

    // ✅ Si le user est déjà OWNER de ce groupe, on ne doit pas consommer une place MEMBER
    // (on “réactive” la membership, rôle owner conservé si déjà owner)
    const isAlreadyOwner =
      existing.exists && String((existing.data() || {}).role || "").toLowerCase() === "owner";

    if (!isAlreadyOwner) {
      // ✅ MEMBER cap (role === "member")
      const tier = await readEntitlementTier(uid);
      const caps = getCaps(tier);

      const memberCount = await countByRole(uid, "member", caps.member + 1);
      if (memberCount >= caps.member) {
        throw new HttpsError("failed-precondition", "MEMBER_GROUP_LIMIT_REACHED", {
          tier,
          current: memberCount,
          max: caps.member,
        });
      }
    }

    // Build identity (client -> participants -> defaults)
    const reqIdentity = req.data?.identity ?? {};
    const pDoc = await db.doc(`participants/${uid}`).get();
    const p = pDoc.exists ? pDoc.data() : {};

    const displayName =
      (typeof reqIdentity.displayName === "string" && reqIdentity.displayName.trim()) ||
      (typeof p.displayName === "string" && p.displayName.trim()) ||
      (p.email ? String(p.email).split("@")[0] : "") ||
      "Invité";

    const avatarUrl =
      reqIdentity.avatarUrl ||
      p.photoURL ||
      p.avatarUrl ||
      p.photoUrl ||
      p.avatar ||
      null;

    const now = FieldValue.serverTimestamp();

    // Upsert membership
    await membershipRef.set(
      {
        groupId,
        uid,
        userId: uid,
        role: isAlreadyOwner ? "owner" : "member",
        active: true,
        status: "active",
        displayName,
        avatarUrl,
        joinedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await db.doc(`groups/${groupId}`).set({ updatedAt: now }, { merge: true });

    const g = snap.data() || {};
    return { ok: true, groupId, groupName: g.name ?? null };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err?.message || "joinGroupWithCap failed");
  }
});