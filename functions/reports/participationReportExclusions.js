import { resolveGroupDisplayName } from "../groups/groupDisplayUtils.js";

/**
 * UIDs exclus des rapports participation (lignes + dénominateur) pour certains groupes.
 * Clé : nom affiché Firestore (`groups.name`) ou `groupId`.
 */
const BY_GROUP_NAME = {
  "NHL 2026-2027 G2": [
    "iUlgNBmkBVRVpqI5yB0l7Uc64nz1",
    "fH0MVU6WAEa40nzJoyfMIKhZSdh1",
  ],
};

const BY_GROUP_ID = {};

function normalizeName(name) {
  return String(name || "").trim();
}

/** @returns {Set<string>} */
export function participationExcludedUidSet({ groupId, groupName, group } = {}) {
  const set = new Set();
  const gid = String(groupId || "").trim();
  const name = normalizeName(groupName || resolveGroupDisplayName(group || {}));

  if (gid && BY_GROUP_ID[gid]) {
    BY_GROUP_ID[gid].forEach((uid) => set.add(String(uid)));
  }
  if (name && BY_GROUP_NAME[name]) {
    BY_GROUP_NAME[name].forEach((uid) => set.add(String(uid)));
  }

  return set;
}

export function isParticipationReportExcluded({ groupId, groupName, group, uid } = {}) {
  const id = String(uid || "").trim();
  if (!id) return false;
  return participationExcludedUidSet({ groupId, groupName, group }).has(id);
}

export function filterParticipationMemberUids(uids, exclusionCtx) {
  const excluded = participationExcludedUidSet(exclusionCtx);
  if (!excluded.size) return uids;
  return uids.filter((uid) => !excluded.has(String(uid)));
}
