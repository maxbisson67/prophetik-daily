// functions/groups.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "./utils.js";

export const joinGroupByCode = onCall(async (req) => {
  try {
    const userId = req.auth?.uid || null;
    if (!userId) throw new HttpsError("unauthenticated", "Auth required.");

    const raw = (req.data?.code ?? "").toString();
    const code = raw.trim();
    if (!code) throw new HttpsError("invalid-argument", "code required");

    const upper = code.toUpperCase();
    const cleaned = upper.replace(/[^A-Z0-9]/g, "");
    const candidates = Array.from(new Set([code, upper, cleaned])).filter(Boolean);

    let foundDoc = null;
    for (const c of candidates) {
      const q = await db.collection("groups").where("codeInvitation", "==", c).limit(1).get();
      if (!q.empty) { foundDoc = q.docs[0]; break; }
    }
    if (!foundDoc) throw new HttpsError("not-found", "Invalid code");

    const groupId = foundDoc.id;
    const membershipId = `${groupId}_${userId}`;

    await db.collection("group_memberships").doc(membershipId).set(
      { active: true, groupId, role: "member", uid: userId, joinedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    const g = foundDoc.data() || {};
    return { ok: true, groupId, groupName: g.name ?? null };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err?.message || "joinGroupByCode failed");
  }
});