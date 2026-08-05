import { db } from "./leaderboard.js";
import { isActiveMembership, isParticipatingMember } from "../groups/groupMembership.js";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickMembershipUid(docId, data = {}) {
  const uid = data.userId || data.uid || data.participantId;
  if (uid) return String(uid).trim();
  const s = String(docId || "").trim();
  const idx = s.indexOf("_");
  return idx > 0 ? s.slice(idx + 1) : s;
}

export async function fetchActiveMemberUids(groupId) {
  const gid = String(groupId || "").trim();
  if (!gid) return [];

  const snap = await db.collection("group_memberships").where("groupId", "==", gid).get();
  const uids = new Set();

  snap.forEach((docSnap) => {
    const m = docSnap.data() || {};
    if (!isActiveMembership(m)) return;
    const uid = pickMembershipUid(docSnap.id, m);
    if (!uid) return;
    uids.add(uid);
  });

  return Array.from(uids);
}

export async function fetchParticipatingMemberUids(groupId) {
  const gid = String(groupId || "").trim();
  if (!gid) return [];

  const snap = await db.collection("group_memberships").where("groupId", "==", gid).get();
  const uids = new Set();

  snap.forEach((docSnap) => {
    const m = docSnap.data() || {};
    if (!isParticipatingMember(m)) return;
    const uid = pickMembershipUid(docSnap.id, m);
    if (!uid) return;
    uids.add(uid);
  });

  return Array.from(uids);
}

export async function fetchActiveHumanMemberUids(groupId) {
  const uids = await fetchParticipatingMemberUids(groupId);
  return uids.filter((uid) => String(uid).toLowerCase() !== "ai");
}

export async function loadPointsByUid({ groupId, seasonId, memberUids }) {
  const gid = String(groupId || "").trim();
  const sid = String(seasonId || "").trim();
  const uids = Array.from(new Set((memberUids || []).map(String).filter(Boolean)));
  const pointsByUid = new Map();

  if (!gid || !sid || !uids.length) return pointsByUid;

  for (const batch of chunk(uids, 100)) {
    const refs = batch.map((uid) =>
      db.doc(`groups/${gid}/leaderboards/${sid}/members/${uid}`)
    );
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap) => {
      pointsByUid.set(snap.id, Number(snap.data()?.pointsTotal ?? 0) || 0);
    });
  }

  for (const uid of uids) {
    if (!pointsByUid.has(uid)) pointsByUid.set(uid, 0);
  }

  return pointsByUid;
}

export function computeRankFromPointsMap(uid, memberUids, pointsByUid) {
  const pk = String(uid || "").trim();
  const uids = Array.from(new Set((memberUids || []).map(String).filter(Boolean)));
  if (!pk || !uids.length) return null;

  const sorted = [...uids].sort((a, b) => {
    const diff = (pointsByUid.get(b) || 0) - (pointsByUid.get(a) || 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  const index = sorted.indexOf(pk);
  return index >= 0 ? index + 1 : null;
}

export async function computeMemberSeasonRank({ groupId, seasonId, uid, memberUids = null }) {
  const uids = memberUids || (await fetchActiveMemberUids(groupId));
  const pointsByUid = await loadPointsByUid({ groupId, seasonId, memberUids: uids });
  return computeRankFromPointsMap(uid, uids, pointsByUid);
}
