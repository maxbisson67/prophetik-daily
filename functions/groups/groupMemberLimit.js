import { HttpsError } from "firebase-functions/v2/https";
import { isActiveMembership } from "./groupMembership.js";

export const MAX_GROUP_MEMBERS = 100;

function pickUid(docId, data = {}) {
  const uid = data.userId || data.uid || data.participantId;
  if (uid) return String(uid).trim();
  const s = String(docId || "").trim();
  const idx = s.indexOf("_");
  return idx > 0 ? s.slice(idx + 1) : s;
}

function isAiMember(data = {}, uid = "") {
  const u = String(uid || data.uid || data.userId || "").toLowerCase();
  if (u === "ai") return true;
  if (String(data.type || "").toLowerCase() === "ai") return true;
  return false;
}

export function throwGroupMemberLimitReached({ current, max = MAX_GROUP_MEMBERS }) {
  throw new HttpsError("failed-precondition", "GROUP_MEMBER_LIMIT_REACHED", {
    current,
    max,
  });
}

/** Compte les membres humains actifs (Nova exclue). */
export async function countActiveHumanMembers(db, groupId) {
  const gid = String(groupId || "").trim();
  if (!gid) return 0;

  const snap = await db.collection("group_memberships").where("groupId", "==", gid).get();
  const uids = new Set();

  snap.forEach((docSnap) => {
    const m = docSnap.data() || {};
    if (!isActiveMembership(m)) return;
    const uid = pickUid(docSnap.id, m);
    if (!uid || isAiMember(m, uid)) return;
    uids.add(uid);
  });

  return uids.size;
}

export async function assertGroupHasMemberCapacity(db, groupId) {
  const current = await countActiveHumanMembers(db, groupId);
  if (current >= MAX_GROUP_MEMBERS) {
    throwGroupMemberLimitReached({ current, max: MAX_GROUP_MEMBERS });
  }
  return { current, max: MAX_GROUP_MEMBERS };
}
