// functions/teamPredictionBundles/novaTpPickAtLock.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";
import { getMlbCurrentSeason } from "../players/seasonHelpers.js";
import { getDateValue, normalizeLeague, safeUpper } from "../teamPredictionChallenges/tpGameSources.js";
import { isMlbScheduleGamePostponed } from "../mlb/mlbGameStatus.js";
import { deriveWinnerAbbr } from "./tpBundleScoring.js";
import {
  computeBundleStatus,
  countCompletedPicks,
  isSlotOpenForPick,
  refreshSlotStatuses,
  TP_LOCK_BEFORE_MINUTES,
} from "./tpBundleUtils.js";

const NOVA_UID = "ai";
const NOVA_DISPLAY_NAME = "Nova";
const NOVA_LOCK_MINUTES_BEFORE = 15;
const MAX_BUNDLES_PER_RUN = 80;

const MLB_AL_ID = "103";
const MLB_NL_ID = "104";

const MLB_ABBR_ALIASES = {
  ARI: ["AZ"],
  AZ: ["ARI"],
  ATH: ["OAK"],
  OAK: ["ATH"],
  CHW: ["CWS"],
  CWS: ["CHW"],
  KC: ["KCR"],
  KCR: ["KC"],
  SD: ["SDP"],
  SDP: ["SD"],
  SF: ["SFG"],
  SFG: ["SF"],
  TB: ["TBR"],
  TBR: ["TB"],
  WSH: ["WSN", "WAS"],
  WSN: ["WSH", "WAS"],
  WAS: ["WSH", "WSN"],
};

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return str(v).toUpperCase();
}

function isInNovaPickWindow(slot = {}, nowMs = Date.now()) {
  const start = getDateValue(slot.gameStartTimeUTC);
  if (!start) return false;

  const startMs = start.getTime();
  const lockMs = TP_LOCK_BEFORE_MINUTES * 60 * 1000;
  const novaStartMs = startMs - NOVA_LOCK_MINUTES_BEFORE * 60 * 1000;
  const cutoffMs = startMs - lockMs;

  return nowMs >= novaStartMs && nowMs < cutoffMs;
}

function normalizeNhlPick(awayScore, homeScore, outcome, slot = {}) {
  const predictedAwayScore = Number(awayScore);
  const predictedHomeScore = Number(homeScore);
  const predictedOutcome = safeUpper(outcome);

  return {
    predictedAwayScore,
    predictedHomeScore,
    predictedOutcome,
    winnerAbbr: deriveWinnerAbbr({
      awayAbbr: slot.awayAbbr,
      homeAbbr: slot.homeAbbr,
      awayScore: predictedAwayScore,
      homeScore: predictedHomeScore,
    }),
  };
}

function normalizeMlbPick(awayScore, homeScore, slot = {}) {
  const predictedAwayScore = Number(awayScore);
  const predictedHomeScore = Number(homeScore);

  return {
    predictedAwayScore,
    predictedHomeScore,
    predictedOutcome: "FINAL",
    winnerAbbr: deriveWinnerAbbr({
      awayAbbr: slot.awayAbbr,
      homeAbbr: slot.homeAbbr,
      awayScore: predictedAwayScore,
      homeScore: predictedHomeScore,
    }),
  };
}

function predictNhlPick(awayStrength, homeStrength, slot = {}) {
  const HOME_ADV = 0.04;
  const homeAdj = homeStrength + HOME_ADV;
  const homeFavored = homeAdj >= awayStrength;
  const margin = Math.abs(homeAdj - awayStrength);

  if (homeFavored) {
    if (margin < 0.04) return normalizeNhlPick(2, 3, "OT", slot);
    if (margin < 0.12) return normalizeNhlPick(2, 3, "REG", slot);
    return normalizeNhlPick(2, 4, "REG", slot);
  }

  if (margin < 0.04) return normalizeNhlPick(3, 2, "OT", slot);
  if (margin < 0.12) return normalizeNhlPick(3, 2, "REG", slot);
  return normalizeNhlPick(4, 2, "REG", slot);
}

function predictMlbPick(awayStrength, homeStrength, slot = {}) {
  const HOME_ADV = 0.03;
  const homeAdj = homeStrength + HOME_ADV;
  const homeFavored = homeAdj >= awayStrength;
  const margin = Math.abs(homeAdj - awayStrength);

  if (homeFavored) {
    if (margin < 0.05) return normalizeMlbPick(4, 5, slot);
    if (margin < 0.12) return normalizeMlbPick(3, 5, slot);
    return normalizeMlbPick(2, 6, slot);
  }

  if (margin < 0.05) return normalizeMlbPick(5, 4, slot);
  if (margin < 0.12) return normalizeMlbPick(5, 3, slot);
  return normalizeMlbPick(6, 2, slot);
}

async function loadNhlStrengthMap() {
  const map = new Map();
  const snap = await db.doc("nhl_standings/current").get();
  if (!snap.exists) return map;

  const standings = Array.isArray(snap.data()?.standings) ? snap.data().standings : [];
  for (const row of standings) {
    const abbr = safeAbbr(row?.teamAbbrev?.default || row?.teamAbbrev);
    const pct = Number(row?.pointPctg);
    if (abbr) map.set(abbr, Number.isFinite(pct) ? pct : 0.5);
  }

  return map;
}

function parseWinPct(raw) {
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const s = str(raw).replace(/^0\./, ".");
  const parsed = Number(s.startsWith(".") ? `0${s}` : s);
  return Number.isFinite(parsed) ? parsed : 0.5;
}

function lookupMlbRecord(maps, abbr) {
  const byAbbr = maps?.byAbbr || {};
  const key = safeAbbr(abbr);
  if (key && byAbbr[key]) return byAbbr[key];

  const aliases = MLB_ABBR_ALIASES[key] || [];
  for (const alias of aliases) {
    if (byAbbr[alias]) return byAbbr[alias];
  }

  return null;
}

async function loadMlbStrengthMap() {
  const byAbbr = {};
  const currentSnap = await db.doc("mlb_standings/current").get();
  const season = currentSnap.exists
    ? str(currentSnap.data()?.season) || getMlbCurrentSeason()
    : getMlbCurrentSeason();

  const leagueIds =
    currentSnap.exists && Array.isArray(currentSnap.data()?.leagueIds)
      ? currentSnap.data().leagueIds.map(String)
      : [MLB_AL_ID, MLB_NL_ID];

  for (const leagueId of leagueIds) {
    const snap = await db.doc(`mlb_standings/${season}/leagues/${leagueId}`).get();
    if (!snap.exists) continue;

    const divisions = Array.isArray(snap.data()?.divisions) ? snap.data().divisions : [];
    for (const div of divisions) {
      const teamRecords = Array.isArray(div?.teamRecords) ? div.teamRecords : [];
      for (const row of teamRecords) {
        const abbr = safeAbbr(row?.team?.abbreviation || row?.team?.fileCode);
        if (!abbr) continue;
        byAbbr[abbr] = parseWinPct(row?.winningPercentage);
      }
    }
  }

  return { byAbbr };
}

async function isMlbSlotPostponed(slot, gameYmd) {
  const gameId = str(slot?.gameId);
  const ymd = str(gameYmd).replace(/\D/g, "");
  if (!gameId || !ymd) return false;

  const snap = await db.doc(`mlb_schedule_daily/${ymd}/games/${gameId}`).get();
  if (!snap.exists) return false;

  return isMlbScheduleGamePostponed(snap.data() || {});
}

function buildPickForSlot({ slot, league, nhlStrengthMap, mlbStrengthMap }) {
  const awayAbbr = safeAbbr(slot.awayAbbr);
  const homeAbbr = safeAbbr(slot.homeAbbr);

  if (normalizeLeague(league) === "MLB") {
    const awayStrength = lookupMlbRecord(mlbStrengthMap, awayAbbr) ?? 0.5;
    const homeStrength = lookupMlbRecord(mlbStrengthMap, homeAbbr) ?? 0.5;
    return predictMlbPick(awayStrength, homeStrength, slot);
  }

  const awayStrength = nhlStrengthMap.get(awayAbbr) ?? 0.5;
  const homeStrength = nhlStrengthMap.get(homeAbbr) ?? 0.5;
  return predictNhlPick(awayStrength, homeStrength, slot);
}

function hasCompletePick(picks = {}, gameId) {
  const pick = picks?.[gameId];
  return (
    pick &&
    Number.isFinite(Number(pick.predictedAwayScore)) &&
    Number.isFinite(Number(pick.predictedHomeScore))
  );
}

async function loadCandidateBundles() {
  const seen = new Map();

  for (const status of ["open", "partial"]) {
    const qs = await db
      .collection("team_prediction_bundles")
      .where("status", "==", status)
      .limit(MAX_BUNDLES_PER_RUN)
      .get();

    for (const doc of qs.docs) {
      seen.set(doc.id, doc);
    }
  }

  return Array.from(seen.values());
}

export const novaTpPickAtLock = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    const nowMs = Date.now();
    const bundles = await loadCandidateBundles();
    if (!bundles.length) return;

    const nhlStrengthMap = await loadNhlStrengthMap();
    const mlbStrengthMap = await loadMlbStrengthMap();

    let processed = 0;

    for (const doc of bundles) {
      const bundleId = doc.id;
      const bundle = doc.data() || {};
      const league = normalizeLeague(bundle.league);
      const groupId = str(bundle.groupId);
      const games = refreshSlotStatuses(bundle.games || [], nowMs);

      if (!groupId || !games.length) continue;

      const entryRef = db.doc(`team_prediction_bundles/${bundleId}/entries/${NOVA_UID}`);
      const entrySnap = await entryRef.get();
      const existingPicks = entrySnap.exists ? entrySnap.data()?.picks || {} : {};

      const newPicks = {};

      for (const slot of games) {
        const gameId = str(slot.gameId);
        if (!gameId) continue;
        if (hasCompletePick(existingPicks, gameId)) continue;
        if (!isSlotOpenForPick(slot, nowMs)) continue;
        if (!isInNovaPickWindow(slot, nowMs)) continue;

        if (league === "MLB" && (await isMlbSlotPostponed(slot, bundle.gameYmd))) {
          continue;
        }

        const pick = buildPickForSlot({ slot, league, nhlStrengthMap, mlbStrengthMap });
        if (!pick?.winnerAbbr) continue;

        newPicks[gameId] = pick;
      }

      if (!Object.keys(newPicks).length) continue;

      const bundleRef = doc.ref;

      await db.runTransaction(async (tx) => {
        const bundleSnap = await tx.get(bundleRef);
        if (!bundleSnap.exists) return;

        const freshBundle = bundleSnap.data() || {};
        const freshStatus = String(freshBundle.status || "open").toLowerCase();
        if (["decided", "cancelled"].includes(freshStatus)) return;

        const freshGames = refreshSlotStatuses(freshBundle.games || [], nowMs);
        const partSnap = await tx.get(entryRef);
        const prior = partSnap.exists ? partSnap.data() || {} : null;
        const mergedPicks = {
          ...(prior?.picks || {}),
          ...newPicks,
        };
        const picksCompletedCount = countCompletedPicks(mergedPicks, freshGames);

        tx.set(
          entryRef,
          {
            uid: NOVA_UID,
            type: "ai",
            displayName: NOVA_DISPLAY_NAME,
            avatarUrl: null,
            bundleId,
            groupId,
            picks: mergedPicks,
            picksCompletedCount,
            pickedBy: NOVA_UID,
            createdAt: prior?.createdAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const bundlePatch = {
          games: freshGames,
          status: computeBundleStatus(freshGames),
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (!partSnap.exists) {
          bundlePatch.participantsCount = FieldValue.increment(1);
        }

        tx.set(bundleRef, bundlePatch, { merge: true });
      });

      processed += 1;
      logger.info("[novaTpPickAtLock] picks saved", {
        bundleId,
        groupId,
        league,
        gameIds: Object.keys(newPicks),
      });
    }

    if (processed > 0) {
      logger.info("[novaTpPickAtLock] done", { processed });
    }
  }
);
