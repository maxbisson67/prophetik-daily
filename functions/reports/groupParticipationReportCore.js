import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue, logger } from "../utils.js";
import { addDaysToYmd, APP_TZ } from "../ProphetikDate.js";
import { resolveGroupDisplayName } from "../groups/groupDisplayUtils.js";
import { isActiveMembership } from "../groups/groupMembership.js";
import { isNovaMember, isParticipatingMember } from "../groups/participationUtils.js";
import {
  countUniqueHumanParticipants,
  dayHadDailyChallenges,
  getEvaluatedGameYmd,
  isActiveGroup,
  loadDailyChallengesForGroup,
} from "../autopilot/autopilotInactivityUtils.js";
import { appendRowsToSheet, ensureSheetHeader } from "./googleSheetsAppend.js";
import { writeParticipationReportPdf } from "./participationReportPdf.js";
import {
  isParticipationReportExcluded,
  participationExcludedUidSet,
} from "./participationReportExclusions.js";

export const COHORT_START_YMD = "2026-09-01";

/** Groupes internes / test — exclus du rapport. */
export const EXCLUDED_GROUP_IDS = new Set([
  "PWhUnDvgPz14pvXRfmxf",
  "ELQZkXaKWMBx3WIGNr5A",
  "0ejYdM8PJ5JMwmyNA4lG",
]);

const CACHE_COLLECTION = "internal_reports";
const CACHE_DOC = "groupParticipationDaily";
const SHEET_NAME = "Daily";

export const REPORT_HEADER = [
  "reportDate",
  "groupId",
  "groupName",
  "groupCreatedDate",
  "sport",
  "activeMembers",
  "participatingMembers",
  "dailyChallenges",
  "dailyParticipants",
  "dailyParticipationRate",
  "avg7DayParticipationRate",
  "generatedAt",
];

function cohortStartTimestamp() {
  return Timestamp.fromDate(new Date(`${COHORT_START_YMD}T00:00:00-04:00`));
}

function tsToYmd(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

function formatRate(participants, eligible) {
  if (!eligible || eligible <= 0) return "";
  const rate = participants / eligible;
  return Math.round(rate * 10000) / 10000;
}

function formatRateDisplay(rate) {
  if (rate === "" || rate == null || Number.isNaN(rate)) return "";
  return `${Math.round(Number(rate) * 10000) / 100}%`;
}

async function loadCohortGroups() {
  const snap = await db
    .collection("groups")
    .where("createdAt", ">=", cohortStartTimestamp())
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter((row) => isActiveGroup(row.data))
    .filter((row) => !EXCLUDED_GROUP_IDS.has(row.id));
}

async function countMembershipStats(groupId, group = null) {
  const snap = await db
    .collection("group_memberships")
    .where("groupId", "==", String(groupId))
    .get();

  const exclusionCtx = { groupId, group };

  let activeMembers = 0;
  let participatingMembers = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const uid = String(data.uid || data.userId || "").trim();
    if (isNovaMember(data, uid)) continue;
    if (isParticipationReportExcluded({ ...exclusionCtx, uid })) continue;
    if (!isActiveMembership(data)) continue;
    activeMembers += 1;
    if (isParticipatingMember(data)) participatingMembers += 1;
  }

  return { activeMembers, participatingMembers };
}

function dayCacheRef(groupId, ymd) {
  return db
    .collection(CACHE_COLLECTION)
    .doc(CACHE_DOC)
    .collection("days")
    .doc(`${String(groupId)}_${String(ymd)}`);
}

async function loadCachedDayMetrics(groupId, ymd) {
  const snap = await dayCacheRef(groupId, ymd).get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

async function saveDayMetrics(groupId, ymd, payload) {
  await dayCacheRef(groupId, ymd).set(
    {
      groupId: String(groupId),
      ymd: String(ymd),
      ...payload,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function computeDayMetrics({ groupId, group, gameYmdDashed }) {
  const challenges = await loadDailyChallengesForGroup({
    groupId,
    gameYmdDashed,
  });

  const hadChallenges = dayHadDailyChallenges(challenges);
  const { activeMembers, participatingMembers } = await countMembershipStats(groupId, group);
  const excluded = participationExcludedUidSet({ groupId, group });

  if (!hadChallenges) {
    return {
      hadChallenges: false,
      dailyChallenges: 0,
      dailyParticipants: 0,
      dailyRate: null,
      activeMembers,
      participatingMembers,
    };
  }

  const { uids } = await countUniqueHumanParticipants(challenges);
  const dailyParticipants = uids.filter((uid) => !excluded.has(uid)).length;

  return {
    hadChallenges: true,
    dailyChallenges: challenges.total,
    dailyParticipants,
    dailyRate: formatRate(dailyParticipants, participatingMembers),
    activeMembers,
    participatingMembers,
  };
}

async function rollingAvg7ParticipationRate(groupId, endYmd, group = null) {
  const rates = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const ymd = addDaysToYmd(endYmd, -offset);
    let cached = await loadCachedDayMetrics(groupId, ymd);

    if (!cached) {
      const computed = await computeDayMetrics({ groupId, group, gameYmdDashed: ymd });
      await saveDayMetrics(groupId, ymd, computed);
      cached = computed;
    }

    if (
      cached.hadChallenges &&
      cached.dailyRate != null &&
      Number(cached.participatingMembers) > 0
    ) {
      rates.push(Number(cached.dailyRate));
    }
  }

  if (!rates.length) return null;
  const sum = rates.reduce((a, b) => a + b, 0);
  return Math.round((sum / rates.length) * 10000) / 10000;
}

/**
 * @param {object} opts
 * @param {string} [opts.reportYmd] - YYYY-MM-DD (defaults: veille Toronto)
 * @param {string} opts.sheetId
 * @param {string} opts.serviceAccountJson
 * @param {boolean} [opts.dryRun]
 * @param {string} [opts.pdfPath] - MVP: write PDF to this path (no Google Sheets)
 */
export async function runGroupParticipationReport({
  reportYmd,
  sheetId,
  serviceAccountJson,
  dryRun = false,
  pdfPath = null,
} = {}) {
  const evaluatedYmd = reportYmd || getEvaluatedGameYmd(new Date());
  const generatedAt = new Date().toISOString();

  const groups = await loadCohortGroups();
  const rows = [];

  logger.info("[groupParticipationReport] start", {
    evaluatedYmd,
    cohortFrom: COHORT_START_YMD,
    groupCount: groups.length,
    dryRun,
  });

  for (const { id: groupId, data: group } of groups) {
    const createdYmd = tsToYmd(group.createdAt);
    if (createdYmd && createdYmd < COHORT_START_YMD) continue;

    const dayMetrics = await computeDayMetrics({
      groupId,
      group,
      gameYmdDashed: evaluatedYmd,
    });

    await saveDayMetrics(groupId, evaluatedYmd, dayMetrics);

    const avg7 = await rollingAvg7ParticipationRate(groupId, evaluatedYmd, group);

    rows.push([
      evaluatedYmd,
      groupId,
      resolveGroupDisplayName(group),
      createdYmd,
      String(group.sport || group.league || "").toUpperCase(),
      dayMetrics.activeMembers,
      dayMetrics.participatingMembers,
      dayMetrics.dailyChallenges,
      dayMetrics.dailyParticipants,
      formatRateDisplay(dayMetrics.dailyRate),
      formatRateDisplay(avg7),
      generatedAt,
    ]);
  }

  rows.sort((a, b) => String(a[2]).localeCompare(String(b[2])));

  if (dryRun) {
    logger.info("[groupParticipationReport] dryRun complete", {
      evaluatedYmd,
      rowCount: rows.length,
    });
    return { evaluatedYmd, rowCount: rows.length, rows, sheetAppend: null, pdf: null };
  }

  if (pdfPath) {
    const pdf = await writeParticipationReportPdf({
      outputPath: pdfPath,
      title: "Prophetik — Group participation report",
      subtitle: `Cohort since ${COHORT_START_YMD} · report date ${evaluatedYmd} · ${rows.length} groups · generated ${generatedAt}`,
      header: REPORT_HEADER,
      rows,
    });

    logger.info("[groupParticipationReport] pdf written", { evaluatedYmd, ...pdf });
    return { evaluatedYmd, rowCount: rows.length, pdf, sheetAppend: null };
  }

  if (!sheetId || !serviceAccountJson) {
    throw new Error(
      "Provide pdfPath for PDF MVP, or sheetId + serviceAccountJson for Google Sheets"
    );
  }

  await ensureSheetHeader({
    serviceAccountJson,
    spreadsheetId: sheetId,
    sheetName: SHEET_NAME,
    headerRow: REPORT_HEADER,
  });

  const sheetAppend = await appendRowsToSheet({
    serviceAccountJson,
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1`,
    rows,
  });

  logger.info("[groupParticipationReport] done", {
    evaluatedYmd,
    rowCount: rows.length,
    sheetAppend,
  });

  return { evaluatedYmd, rowCount: rows.length, sheetAppend };
}
