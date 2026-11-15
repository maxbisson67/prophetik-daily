import { Timestamp } from "firebase-admin/firestore";
import { writeFileSync } from "node:fs";
import { db, logger } from "../utils.js";
import { addDaysToYmd, APP_TZ, appYmd } from "../ProphetikDate.js";
import { resolveGroupDisplayName } from "../groups/groupDisplayUtils.js";
import { isActiveMembership } from "../groups/groupMembership.js";
import { isNovaMember, isParticipatingMember } from "../groups/participationUtils.js";
import {
  countUniqueHumanParticipants,
  getEvaluatedGameYmd,
  isActiveGroup,
  loadDailyChallengesForGroup,
} from "../autopilot/autopilotInactivityUtils.js";
import { EXCLUDED_GROUP_IDS } from "./groupParticipationReportCore.js";
import { filterParticipationMemberUids } from "./participationReportExclusions.js";
import { buildParticipationReportPdfBuffer } from "./participationReportPdf.js";

/** Groupes créés à partir de cette date (YYYY-MM-DD, Toronto). */
export const GRID_COHORT_START_YMD = process.env.COHORT_START_YMD || "2026-10-04";
const MAX_TOTAL_DAYS = 90;

/** Export CSV (sans groupId ni métadonnées de période / génération). */
export const GRID_CSV_HEADER = [
  "groupName",
  "groupCreatedDate",
  "sport",
  "participantUid",
  "participantName",
  "pct7j",
  "pctTotal",
  "daysPlayed7j",
  "challengeDays7j",
  "daysPlayedTotal",
  "challengeDaysTotal",
];

export const GRID_GROUP_AVG_LABEL = "— Moyenne groupe —";

function cohortStartTimestamp(ymd = GRID_COHORT_START_YMD) {
  return Timestamp.fromDate(new Date(`${ymd}T00:00:00-04:00`));
}

function tsToYmd(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

/**
 * Dernier jour inclus dans la grille (%7j / %total).
 * @param {object} [opts]
 * @param {string} [opts.throughYmd] - YYYY-MM-DD explicite (prioritaire)
 * @param {boolean} [opts.includeCurrentDay] - inclure le jour calendaire Toronto (appYmd)
 */
export function resolveParticipationGridEndYmd({
  throughYmd = null,
  includeCurrentDay = false,
  now = new Date(),
} = {}) {
  const explicit = String(throughYmd || "").slice(0, 10);
  if (explicit) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(explicit)) {
      throw new Error(`Invalid throughYmd: ${throughYmd}`);
    }
    const today = appYmd(now);
    if (explicit > today) {
      throw new Error(`throughYmd ${explicit} is after today (${today})`);
    }
    return explicit;
  }
  if (includeCurrentDay) {
    return appYmd(now);
  }
  return getEvaluatedGameYmd(now);
}

function last7Ymds(endYmd) {
  const out = [];
  for (let i = 0; i < 7; i += 1) out.push(addDaysToYmd(endYmd, -i));
  return out.reverse();
}

function enumerateYmdRange(fromYmd, toYmd, maxDays = MAX_TOTAL_DAYS) {
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

async function loadCohortGroups(cohortYmd) {
  const snap = await db
    .collection("groups")
    .where("createdAt", ">=", cohortStartTimestamp(cohortYmd))
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter((row) => isActiveGroup(row.data))
    .filter((row) => !EXCLUDED_GROUP_IDS.has(row.id));
}

async function loadMembershipForParticipationGrid(groupId) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get();

  const participatingUids = [];
  const displayUids = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const uid = String(data.uid || data.userId || "").trim();
    if (isNovaMember(data, uid)) continue;
    if (!isActiveMembership(data) || !uid) continue;
    displayUids.push(uid);
    if (!isParticipatingMember(data)) continue;
    participatingUids.push(uid);
  }

  return {
    participatingUids,
    displayUids: [...new Set(displayUids)],
  };
}

async function aggregatePeriod(groupId, ymds, participatingSet) {
  const uidPlayDays = new Map();
  let challengeDayCount = 0;

  for (const ymd of ymds) {
    const challenges = await loadDailyChallengesForGroup({
      groupId,
      gameYmdDashed: ymd,
    });
    if (!challenges.total) continue;

    challengeDayCount += 1;
    const { uids } = await countUniqueHumanParticipants(challenges);
    uids.forEach((uid) => {
      if (!participatingSet.has(uid)) return;
      uidPlayDays.set(uid, (uidPlayDays.get(uid) || 0) + 1);
    });
  }

  return { uidPlayDays, challengeDayCount };
}

function memberRate(daysPlayed, challengeDayCount) {
  if (!challengeDayCount) return null;
  return daysPlayed / challengeDayCount;
}

/** Moyenne arithmétique des taux membres (jours joués ÷ jours avec défis). */
function averageMemberRates(memberUids, uidPlayDays, challengeDayCount) {
  if (!challengeDayCount || !memberUids.length) return null;
  let sum = 0;
  for (const uid of memberUids) {
    sum += (uidPlayDays.get(uid) || 0) / challengeDayCount;
  }
  return sum / memberUids.length;
}

function formatPct(rate) {
  if (rate == null || Number.isNaN(rate)) return "";
  return `${Math.round(rate * 1000) / 10}%`;
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

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function resolveTotalFromYmd(groupCreatedYmd, cohortYmd) {
  const created = String(groupCreatedYmd || "").slice(0, 10);
  const cohort = String(cohortYmd || "").slice(0, 10);
  if (created && cohort && created > cohort) return created;
  return cohort;
}

/**
 * Grille participant × groupe (%7j, %Total) — même logique que l’app Classement.
 */
export async function buildGroupParticipationGrid({
  cohortStartYmd = GRID_COHORT_START_YMD,
  throughYmd = null,
  includeCurrentDay = false,
} = {}) {
  const endYmd = resolveParticipationGridEndYmd({ throughYmd, includeCurrentDay });
  const generatedAt = new Date().toISOString();
  const groups = await loadCohortGroups(cohortStartYmd);

  logger.info("[participationGrid] start", {
    cohortStartYmd,
    endYmd,
    includeCurrentDay: !!includeCurrentDay,
    throughYmd: throughYmd || null,
    groupCount: groups.length,
  });

  const gridRows = [];
  const groupSummaries = [];
  const allUids = [];

  for (const { id: groupId, data: group } of groups) {
    const createdYmd = tsToYmd(group.createdAt);
    const totalFrom = resolveTotalFromYmd(createdYmd, cohortStartYmd);
    const totalTo = endYmd;
    const ymds7 = last7Ymds(endYmd);
    const ymdsTotal = enumerateYmdRange(totalFrom, totalTo);

    const membership = await loadMembershipForParticipationGrid(groupId);
    const participatingUids = filterParticipationMemberUids(membership.participatingUids, {
      groupId,
      group,
    });
    const displayUids = filterParticipationMemberUids(membership.displayUids, {
      groupId,
      group,
    });
    displayUids.forEach((uid) => allUids.push(uid));
    const participatingSet = new Set(participatingUids);

    if (!displayUids.length) continue;

    const [stats7, statsTotal] = await Promise.all([
      aggregatePeriod(groupId, ymds7, participatingSet),
      aggregatePeriod(groupId, ymdsTotal, participatingSet),
    ]);

    const groupName = resolveGroupDisplayName(group);
    const sport = String(group.sport || group.league || "").toUpperCase();
    const avgRate7 = averageMemberRates(
      participatingUids,
      stats7.uidPlayDays,
      stats7.challengeDayCount
    );
    const avgRateTotal = averageMemberRates(
      participatingUids,
      statsTotal.uidPlayDays,
      statsTotal.challengeDayCount
    );

    groupSummaries.push({
      groupId,
      groupName,
      groupCreatedDate: createdYmd,
      sport,
      memberCount: participatingUids.length,
      avgRate7,
      avgRateTotal,
      pct7j: formatPct(avgRate7),
      pctTotal: formatPct(avgRateTotal),
      challengeDays7j: stats7.challengeDayCount,
      challengeDaysTotal: statsTotal.challengeDayCount,
      totalPeriodFrom: totalFrom,
      totalPeriodTo: totalTo,
    });

    for (const uid of displayUids) {
      const eligible = participatingSet.has(uid);
      const days7 = stats7.uidPlayDays.get(uid) || 0;
      const daysTotal = statsTotal.uidPlayDays.get(uid) || 0;
      const rate7 = eligible ? memberRate(days7, stats7.challengeDayCount) : null;
      const rateTotal = eligible
        ? memberRate(daysTotal, statsTotal.challengeDayCount)
        : null;

      gridRows.push({
        groupId,
        groupName,
        groupCreatedDate: createdYmd,
        sport,
        participantUid: uid,
        participantName: uid,
        isGroupAverage: false,
        pct7j: formatPct(rate7),
        pctTotal: formatPct(rateTotal),
        daysPlayed7j: eligible ? days7 : "",
        challengeDays7j: stats7.challengeDayCount,
        daysPlayedTotal: eligible ? daysTotal : "",
        challengeDaysTotal: statsTotal.challengeDayCount,
      });
    }

    gridRows.push({
      groupId,
      groupName,
      groupCreatedDate: createdYmd,
      sport,
      participantUid: "",
      participantName: GRID_GROUP_AVG_LABEL,
      isGroupAverage: true,
      pct7j: formatPct(avgRate7),
      pctTotal: formatPct(avgRateTotal),
      daysPlayed7j: "",
      challengeDays7j: stats7.challengeDayCount,
      daysPlayedTotal: "",
      challengeDaysTotal: statsTotal.challengeDayCount,
    });
  }

  const names = await loadDisplayNames(allUids);
  gridRows.forEach((row) => {
    row.participantName = names.get(row.participantUid) || row.participantUid;
  });

  gridRows.sort((a, b) => {
    const g = String(a.groupName).localeCompare(String(b.groupName));
    if (g !== 0) return g;
    if (a.isGroupAverage && !b.isGroupAverage) return 1;
    if (!a.isGroupAverage && b.isGroupAverage) return -1;
    return String(a.participantName).localeCompare(String(b.participantName));
  });

  groupSummaries.sort((a, b) =>
    String(a.groupName).localeCompare(String(b.groupName))
  );

  logger.info("[participationGrid] done", {
    rowCount: gridRows.length,
    groupCount: groupSummaries.length,
  });

  return {
    cohortStartYmd,
    endYmd,
    includeCurrentDay: !!includeCurrentDay,
    throughYmd: throughYmd ? String(throughYmd).slice(0, 10) : null,
    generatedAt,
    gridRows,
    groupSummaries,
  };
}

export function gridRowsToCsv(gridRows) {
  const lines = [GRID_CSV_HEADER.join(",")];
  for (const row of gridRows) {
    lines.push(
      GRID_CSV_HEADER.map((key) => csvEscape(row[key])).join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function writeParticipationGridCsv(outputPath, options = {}) {
  const { gridRows } = await buildGroupParticipationGrid(options);
  writeFileSync(outputPath, gridRowsToCsv(gridRows), "utf8");
  return { outputPath, rowCount: gridRows.length };
}

/** PDF tabulaire (une grande grille — ouvrir aussi le CSV dans Excel). */
export async function writeParticipationGridPdf(outputPath, options = {}) {
  const { cohortStartYmd, endYmd, generatedAt, gridRows, groupSummaries } =
    await buildGroupParticipationGrid(options);

  const header = ["Participant", "%7j", "%Total"];

  const rows = [];
  let lastGroupId = null;

  for (const r of gridRows) {
    if (r.groupId !== lastGroupId) {
      lastGroupId = r.groupId;
      const summary = groupSummaries.find((s) => s.groupId === r.groupId);
      const sport = summary?.sport ? ` · ${summary.sport}` : "";
      const members = summary?.memberCount ?? "";
      rows.push([
        `${r.groupName}${sport} (${members} actifs · moy. 7j ${summary?.pct7j || "—"} · total ${summary?.pctTotal || "—"})`,
        "",
        "",
      ]);
    }

    if (r.isGroupAverage) continue;

    rows.push([r.participantName, r.pct7j, r.pctTotal]);
  }

  const buffer = await buildParticipationReportPdfBuffer({
    title: "Prophetik — Grille participation par groupe",
    subtitle: `Cohort ≥ ${cohortStartYmd} · jusqu’au ${endYmd} · ${gridRows.length} lignes · ${generatedAt}`,
    header,
    rows,
  });

  writeFileSync(outputPath, buffer);
  return { outputPath, rowCount: gridRows.length, bytes: buffer.length };
}
