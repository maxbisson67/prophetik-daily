/**
 * Participation d'une journée pour un groupe (membres inscrits + oui/non).
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/admin.json
 *   cd functions
 *
 *   node scripts/runGroupDailyParticipationReport.js \
 *     --groupId GJEpz6FmYbgzCESACiyW \
 *     --ymd 2026-10-23
 *
 *   # Aujourd'hui (Toronto) si --ymd omis :
 *   node scripts/runGroupDailyParticipationReport.js --groupId GJEpz6FmYbgzCESACiyW
 *
 *   # Plusieurs groupes (virgules ou --groupId répété) :
 *   node scripts/runGroupDailyParticipationReport.js \
 *     --groupIds id1,id2,id3
 *   node scripts/runGroupDailyParticipationReport.js --groupId id1 --groupId id2
 *
 *   node scripts/runGroupDailyParticipationReport.js \
 *     --groupId GJEpz6FmYbgzCESACiyW \
 *     --ymd 2026-10-24 \
 *     --csv ./out/group-day.csv
 *
 *   --include-non-participating  inclure membres actifs non « participating »
 *   --json                       sortie JSON complète (défaut : liste nom — oui/non)
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync } from "node:fs";
import {
  buildGroupDailyParticipationReport,
  dailyParticipationRowsToCsv,
} from "../reports/groupDailyParticipationReport.js";

if (!getApps().length) {
  initializeApp();
}

getFirestore();

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function collectGroupIds() {
  const ids = [];

  const fromList = argValue("--groupIds") || process.env.GROUP_IDS || "";
  if (fromList) {
    for (const part of String(fromList).split(/[\s,;]+/)) {
      const id = part.trim();
      if (id) ids.push(id);
    }
  }

  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === "--groupId" && process.argv[i + 1]) {
      ids.push(String(process.argv[i + 1]).trim());
    }
  }

  const single = process.env.GROUP_ID;
  if (single && !ids.length) ids.push(String(single).trim());

  return [...new Set(ids.filter(Boolean))];
}

const groupIds = collectGroupIds();
const ymd = argValue("--ymd") || process.env.REPORT_YMD || null;
const csvPath = argValue("--csv") || process.env.DAILY_PARTICIPATION_CSV || null;
const includeNonParticipating =
  hasFlag("--include-non-participating") ||
  String(process.env.INCLUDE_NON_PARTICIPATING || "").toLowerCase() === "true";
const jsonOutput = hasFlag("--json");

async function main() {
  if (!groupIds.length) {
    console.error("Required: --groupId <id> and/or --groupIds id1,id2,...");
    process.exit(1);
  }

  const baseOpts = { ymd, includeNonParticipating };
  const reports = [];

  for (const groupId of groupIds) {
    reports.push(await buildGroupDailyParticipationReport({ ...baseOpts, groupId }));
  }

  if (csvPath) {
    const body = reports
      .map((r, idx) => {
        const csv = dailyParticipationRowsToCsv(r);
        if (idx === 0) return csv;
        return csv.replace(/^[^\n]+\n/, "");
      })
      .join("");
    writeFileSync(csvPath, body, "utf8");
    console.log(
      JSON.stringify(
        {
          ok: true,
          csv: csvPath,
          groupCount: reports.length,
          summaries: reports.map(summarize),
        },
        null,
        2
      )
    );
    return;
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          groupCount: reports.length,
          reports: reports.map((r) => ({ ...summarize(r), members: r.rows })),
        },
        null,
        2
      )
    );
    return;
  }

  reports.forEach((report, idx) => {
    if (idx > 0) console.log("");
    printHumanList(report);
  });
}

function printHumanList(report) {
  const { groupName, ymd, hadChallenges, enrolledParticipatingCount, playedAmongParticipating } =
    report;
  const challengeHint = hadChallenges
    ? `${report.challengeCount} défi(s) auto`
    : "aucun défi auto ce jour";

  console.log(`${groupName} · ${ymd} · ${challengeHint}`);

  const pct =
    enrolledParticipatingCount > 0
      ? Math.round((playedAmongParticipating / enrolledParticipatingCount) * 1000) / 10
      : null;
  const pctSuffix = pct != null ? ` (${pct} %)` : "";

  console.log(
    `${playedAmongParticipating}/${enrolledParticipatingCount}${pctSuffix} participant(s) actif(s) ont joué`
  );
  console.log("");

  const rows = [...(report.rows || [])].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "fr")
  );

  for (const row of rows) {
    console.log(`${row.name} — ${row.participatedLabel}`);
  }
}

function summarize(report) {
  return {
    groupId: report.groupId,
    groupName: report.groupName,
    ymd: report.ymd,
    hadChallenges: report.hadChallenges,
    challengeCount: report.challengeCount,
    enrolledParticipating: report.enrolledParticipatingCount,
    playedAmongParticipating: report.playedAmongParticipating,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
