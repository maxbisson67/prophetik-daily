import { writeFileSync } from "node:fs";
import { db } from "../utils.js";
import { appYmd } from "../ProphetikDate.js";
import { resolveGroupDisplayName } from "../groups/groupDisplayUtils.js";
import { isActiveMembership } from "../groups/groupMembership.js";
import {
  isNovaMember,
  isParticipatingMember,
  resolveParticipation,
} from "../groups/participationUtils.js";
import {
  countUniqueHumanParticipants,
  loadDailyChallengesForGroup,
} from "../autopilot/autopilotInactivityUtils.js";

function normalizeYmd(input) {
  const ymd = String(input || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`Invalid ymd: ${input}`);
  }
  const today = appYmd(new Date());
  if (ymd > today) {
    throw new Error(`ymd ${ymd} is after today (${today}) in Toronto`);
  }
  return ymd;
}

async function loadGroupMembers(groupId, { includeNonParticipating = false } = {}) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get();

  const rows = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const uid = String(data.uid || data.userId || "").trim();
    if (!uid || isNovaMember(data, uid)) continue;
    if (!isActiveMembership(data)) continue;

    const participating = isParticipatingMember(data);
    if (!includeNonParticipating && !participating) continue;

    rows.push({
      uid,
      role: String(data.role || "member").toLowerCase(),
      participation: resolveParticipation(data),
      participating,
    });
  }

  rows.sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
  return rows;
}

async function loadDisplayNames(uids) {
  const names = new Map();
  const unique = [...new Set(uids.filter(Boolean))];

  await Promise.all(
    unique.map(async (uid) => {
      try {
        const [pubSnap, partSnap] = await Promise.all([
          db.doc(`profiles_public/${uid}`).get(),
          db.doc(`participants/${uid}`).get(),
        ]);
        const pub = pubSnap.exists ? pubSnap.data() || {} : {};
        const part = partSnap.exists ? partSnap.data() || {} : {};
        const name =
          String(pub.displayName || part.displayName || part.email?.split("@")[0] || "").trim() ||
          uid;
        names.set(uid, name);
      } catch {
        names.set(uid, uid);
      }
    })
  );

  return names;
}

/**
 * Rapport jour × groupe : membres inscrits (participating) + indicateur de jeu.
 */
export async function buildGroupDailyParticipationReport({
  groupId,
  ymd = null,
  includeNonParticipating = false,
} = {}) {
  const gid = String(groupId || "").trim();
  if (!gid) throw new Error("groupId required");

  const gameYmd = normalizeYmd(ymd || appYmd(new Date()));

  const groupSnap = await db.doc(`groups/${gid}`).get();
  if (!groupSnap.exists) throw new Error(`Group not found: ${gid}`);
  const group = groupSnap.data() || {};

  const members = await loadGroupMembers(gid, { includeNonParticipating });
  const names = await loadDisplayNames(members.map((m) => m.uid));

  const challenges = await loadDailyChallengesForGroup({
    groupId: gid,
    gameYmdDashed: gameYmd,
  });
  const { uids: playedSet } = await countUniqueHumanParticipants(challenges);

  const rows = members.map((m) => {
    const participated = playedSet.has(m.uid);
    return {
      uid: m.uid,
      name: names.get(m.uid) || m.uid,
      role: m.role,
      participation: m.participation,
      enrolledParticipating: m.participating,
      participated,
      participatedLabel: participated ? "oui" : "non",
    };
  });

  const participatingRows = rows.filter((r) => r.enrolledParticipating);
  const playedCount = participatingRows.filter((r) => r.participated).length;

  return {
    groupId: gid,
    groupName: resolveGroupDisplayName(group),
    ymd: gameYmd,
    generatedAt: new Date().toISOString(),
    hadChallenges: challenges.total > 0,
    challengeCount: challenges.total,
    enrolledParticipatingCount: participatingRows.length,
    playedAmongParticipating: playedCount,
    rows,
  };
}

export function dailyParticipationRowsToCsv(report) {
  const header = [
    "groupName",
    "ymd",
    "participantName",
    "participantUid",
    "participation",
    "participated",
  ];
  const lines = [header.join(",")];

  for (const row of report.rows || []) {
    const cells = [
      report.groupName,
      report.ymd,
      row.name,
      row.uid,
      row.participation,
      row.participatedLabel,
    ].map((v) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(cells.join(","));
  }

  return `${lines.join("\n")}\n`;
}

export async function writeGroupDailyParticipationCsv(outputPath, options) {
  const report = await buildGroupDailyParticipationReport(options);
  writeFileSync(outputPath, dailyParticipationRowsToCsv(report), "utf8");
  return { outputPath, rowCount: report.rows.length, report };
}
