// functions/groups.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "./utils.js";

export const joinGroupByCode = onCall(async (req) => {
  try {
    const uid = req.auth?.uid || null;
    if (!uid) throw new HttpsError("unauthenticated", "Auth required.");

    // ---------- Validate + normalize code ----------
    const raw = String(req.data?.code ?? "").trim();
    if (!raw) throw new HttpsError("invalid-argument", "code required");

    const upper = raw.toUpperCase();
    const cleaned = upper.replace(/[^A-Z0-9]/g, ""); // keep legacy tolerance
    const candidates = Array.from(new Set([raw, upper, cleaned])).filter(Boolean);

    // ---------- Find group by codeInvitation ----------
    let snap = null;
    for (const c of candidates) {
      const q = await db.collection("groups").where("codeInvitation", "==", c).limit(1).get();
      if (!q.empty) { snap = q.docs[0]; break; }
    }
    if (!snap) throw new HttpsError("not-found", "Invalid code");

    const groupId = snap.id;
    const membershipId = `${groupId}_${uid}`;

    // ---------- Build identity (client -> participants -> defaults) ----------
    const reqIdentity = (req.data?.identity ?? {});
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

    // ---------- Upsert membership ----------
    const now = FieldValue.serverTimestamp();
    await db.collection("group_memberships").doc(membershipId).set(
      {
        groupId,
        uid,
        role: "member",
        active: true,
        status: "active",
        displayName,
        avatarUrl,
        joinedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    // Optional: bump a simple member count or touch updatedAt on group
    await db.doc(`groups/${groupId}`).set(
      { updatedAt: now },
      { merge: true }
    );

    const g = snap.data() || {};
    return { ok: true, groupId, groupName: g.name ?? null };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err?.message || "joinGroupByCode failed");
  }
});