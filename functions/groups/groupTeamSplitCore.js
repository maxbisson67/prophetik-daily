import { HttpsError } from "firebase-functions/v2/https";
import { isActiveMembership } from "./groupMembership.js";
import { isNovaMember, isParticipatingMember } from "./participationUtils.js";

export const TEAM_IDS = { A: "a", B: "b" };
const TEAM_NAME_MAX = 24;

export function normalizeTeamSplitNames(teamAName, teamBName) {
  const a = String(teamAName ?? "Équipe A").trim() || "Équipe A";
  const b = String(teamBName ?? "Équipe B").trim() || "Équipe B";
  if (a.length > TEAM_NAME_MAX || b.length > TEAM_NAME_MAX) {
    throw new HttpsError("invalid-argument", "TEAM_NAME_TOO_LONG", { max: TEAM_NAME_MAX });
  }
  return { teamAName: a, teamBName: b };
}

export function normalizeTeamSplitRoster(raw = {}) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [uid, team] of Object.entries(raw)) {
    const id = String(uid || "").trim();
    const t = String(team || "").toLowerCase();
    if (!id || id.toLowerCase() === "ai") continue;
    if (t !== TEAM_IDS.A && t !== TEAM_IDS.B) {
      throw new HttpsError("invalid-argument", "INVALID_TEAM_ID", { uid: id, team: t });
    }
    out[id] = t;
  }
  return out;
}

export async function loadParticipatingHumanUids(db, groupId) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get();

  const uids = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const uid = String(data.uid || data.userId || "").trim();
    if (isNovaMember(data, uid)) continue;
    if (!isActiveMembership(data)) continue;
    if (!isParticipatingMember(data)) continue;
    if (uid) uids.push(uid);
  }
  return [...new Set(uids)];
}

export function teamSplitHasBothTeams(roster = {}) {
  let hasA = false;
  let hasB = false;
  for (const t of Object.values(roster || {})) {
    if (t === TEAM_IDS.A) hasA = true;
    if (t === TEAM_IDS.B) hasB = true;
    if (hasA && hasB) return true;
  }
  return false;
}
