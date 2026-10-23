import firestore from "@react-native-firebase/firestore";
import { isActiveMembership } from "@src/groups/groupOwnership";
import { isNovaMember, isParticipatingMember } from "@src/groups/participationUtils";
import { addDaysToYmd, getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";

const AI_UID = "ai";

export function ymdToCompact(ymdDashed) {
  return String(ymdDashed || "").replace(/-/g, "");
}

export const MAX_TOTAL_PARTICIPATION_DAYS = 90;

export function evaluatedGameYmd(now = new Date()) {
  return addDaysToYmd(getProphetikBusinessYmd(now), -1);
}

export function last7GameYmds(endYmd = null) {
  const end = endYmd || evaluatedGameYmd();
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    out.push(addDaysToYmd(end, -i));
  }
  return out.reverse();
}

/** Liste inclusive from→to (YYYY-MM-DD), plafonnée si trop longue (fenêtre finissant à toYmd). */
export function enumerateYmdRange(fromYmd, toYmd, maxDays = MAX_TOTAL_PARTICIPATION_DAYS) {
  const from = String(fromYmd || "").slice(0, 10);
  const to = String(toYmd || "").slice(0, 10);
  if (!from || !to || from > to) return [];

  const all = [];
  let cursor = from;
  while (cursor <= to) {
    all.push(cursor);
    cursor = addDaysToYmd(cursor, 1);
  }

  if (all.length <= maxDays) return all;
  return all.slice(all.length - maxDays);
}

function humanUidFromEntryDoc(entryDoc) {
  const uid = String(entryDoc.id || entryDoc.data()?.uid || "").trim();
  if (!uid || uid.toLowerCase() === AI_UID) return null;
  return uid;
}

async function collectUidsFromChallengeDoc(doc) {
  const sub =
    doc.ref.parent.id === "defis" || doc.ref.path.includes("/defis/")
      ? "participations"
      : "entries";
  const snap = await doc.ref.collection(sub).get();
  const uids = new Set();
  snap.docs.forEach((entryDoc) => {
    const uid = humanUidFromEntryDoc(entryDoc);
    if (uid) uids.add(uid);
  });
  return uids;
}

export async function loadDailyChallengeParticipantUids(groupId, gameYmdDashed) {
  const gid = String(groupId);
  const ymdCompact = ymdToCompact(gameYmdDashed);

  const [fgcSnap, tpSnap, tsSnap] = await Promise.all([
    firestore()
      .collection("first_goal_challenges")
      .where("groupId", "==", gid)
      .where("gameYmd", "==", gameYmdDashed)
      .get(),
    firestore()
      .collection("team_prediction_bundles")
      .where("groupId", "==", gid)
      .where("gameYmd", "==", ymdCompact)
      .get(),
    firestore()
      .collection("defis")
      .where("groupId", "==", gid)
      .where("gameDate", "==", gameYmdDashed)
      .where("type", "==", 3)
      .get(),
  ]);

  const challengeDocs = [...fgcSnap.docs, ...tpSnap.docs, ...tsSnap.docs];
  if (!challengeDocs.length) {
    return { hadChallenges: false, uids: new Set(), challengeCount: 0 };
  }

  const uidSets = await Promise.all(challengeDocs.map((d) => collectUidsFromChallengeDoc(d)));
  const uids = new Set();
  uidSets.forEach((set) => set.forEach((u) => uids.add(u)));

  return { hadChallenges: true, uids, challengeCount: challengeDocs.length };
}

export async function loadParticipatingMemberUids(groupId) {
  const snap = await firestore()
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get();

  const participating = [];
  const displayUids = [];
  let activeMembers = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const uid = String(data.uid || data.userId || "").trim();
    if (isNovaMember(data, uid)) return;
    if (!isActiveMembership(data)) return;
    if (!uid) return;
    activeMembers += 1;
    displayUids.push(uid);
    if (!isParticipatingMember(data)) return;
    participating.push(uid);
  });

  const uniqueDisplay = [...new Set(displayUids)];

  return {
    activeMembers,
    participatingMembers: participating.length,
    participatingUids: participating,
    /** Tous les humains actifs dans le groupe (même sans participation aux défis encore). */
    displayUids: uniqueDisplay,
  };
}
