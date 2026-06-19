import { Timestamp } from "firebase-admin/firestore";
import { buildEmptyMlbPitcher } from "../mlb/mlbProbablePitchers.js";
import {
  TP_DEFAULT_SCORING,
  getDateValue,
  normalizeLeague,
  safeUpper,
} from "../teamPredictionChallenges/tpGameSources.js";

export const TP_BUNDLE_MAX_GAMES = 3;
export const TP_LOCK_BEFORE_MINUTES = 5;
export const TP_EXPIRES_AFTER_DAYS = 2;

export function getBusinessDate(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

export function ymdFromBusinessDate(now = new Date()) {
  const d = getBusinessDate(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function buildTeamPredictionBundleId({ league, groupId, gameYmd }) {
  return `tpb_${normalizeLeague(league).toLowerCase()}_${groupId}_${gameYmd}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function computeLockedAt(startDate) {
  return new Date(startDate.getTime() - TP_LOCK_BEFORE_MINUTES * 60 * 1000);
}

export function isSlotOpenForPick(slot = {}, nowMs = Date.now()) {
  const status = String(slot.status || "open").toLowerCase();
  if (status !== "open") return false;

  const lockedAt = getDateValue(slot.lockedAt);
  if (lockedAt && nowMs >= lockedAt.getTime()) return false;

  return true;
}

export function refreshSlotStatuses(games = [], nowMs = Date.now()) {
  return (games || []).map((slot) => {
    const status = String(slot.status || "open").toLowerCase();
    if (status === "decided") return slot;

    const lockedAt = getDateValue(slot.lockedAt);
    const start = getDateValue(slot.gameStartTimeUTC);

    if (lockedAt && nowMs >= lockedAt.getTime()) {
      if (status === "open") {
        return { ...slot, status: start && nowMs >= start.getTime() ? "live" : "locked" };
      }
    }

    return slot;
  });
}

export function computeBundleStatus(games = []) {
  const slots = games || [];
  if (!slots.length) return "open";

  const statuses = slots.map((g) => String(g.status || "open").toLowerCase());

  if (statuses.every((s) => s === "decided")) return "decided";
  if (statuses.every((s) => ["locked", "live", "decided"].includes(s))) {
    return statuses.some((s) => s === "decided") ? "partial" : "locked";
  }
  if (statuses.some((s) => ["locked", "live", "decided"].includes(s))) return "partial";
  return "open";
}

export function countCompletedPicks(picks = {}, games = []) {
  const map = picks && typeof picks === "object" ? picks : {};
  let count = 0;

  for (const slot of games || []) {
    const gameId = String(slot.gameId || "");
    if (!gameId) continue;
    const pick = map[gameId];
    if (
      pick &&
      Number.isFinite(Number(pick.predictedAwayScore)) &&
      Number.isFinite(Number(pick.predictedHomeScore))
    ) {
      count += 1;
    }
  }

  return count;
}

export function buildBundleGameSlot({
  slot,
  gameId,
  awayAbbr,
  homeAbbr,
  startDate,
  isFavoriteGame = false,
  league = "NHL",
  awayProbablePitcher = null,
  homeProbablePitcher = null,
}) {
  const lockedAtDate = computeLockedAt(startDate);

  return {
    slot,
    gameId: String(gameId),
    awayAbbr: safeUpper(awayAbbr),
    homeAbbr: safeUpper(homeAbbr),
    gameStartTimeUTC: Timestamp.fromDate(startDate),
    lockedAt: Timestamp.fromDate(lockedAtDate),
    isFavoriteGame: !!isFavoriteGame,
    status: "open",
    ...(normalizeLeague(league) === "MLB"
      ? {
          awayProbablePitcher: awayProbablePitcher || buildEmptyMlbPitcher(),
          homeProbablePitcher: homeProbablePitcher || buildEmptyMlbPitcher(),
        }
      : {}),
    officialResult: {
      winnerAbbr: null,
      awayScore: null,
      homeScore: null,
      outcome: null,
      confirmedAt: null,
    },
    payoutApplied: false,
    payoutAppliedAt: null,
  };
}

export function defaultBundlePayload({
  groupId,
  league,
  gameYmd,
  games,
  createdBy,
  favoriteTeamSnapshot = null,
  autopilotCreated = false,
}) {
  const expiresAtDate = addDays(new Date(), TP_EXPIRES_AFTER_DAYS);

  return {
    type: "team_prediction_bundle",
    groupId: String(groupId),
    league: normalizeLeague(league),
    gameYmd: String(gameYmd),
    games,
    gameCount: games.length,
    status: computeBundleStatus(games),
    favoriteTeamSnapshot,
    participantsCount: 0,
    scoring: { ...TP_DEFAULT_SCORING },
    createdBy: autopilotCreated ? "system" : String(createdBy),
    autopilotCreated: !!autopilotCreated,
    createdAt: null,
    updatedAt: null,
    expiresAt: Timestamp.fromDate(expiresAtDate),
    payoutApplied: false,
    payoutAppliedAt: null,
    decidedAt: null,
  };
}

export function normalizeTeamAbbr(v) {
  return safeUpper(v);
}

export function gameInvolvesFavorite(game, favoriteTeam) {
  if (!favoriteTeam) return false;

  const favAbbr = normalizeTeamAbbr(favoriteTeam.abbreviation);
  const favTeamId = String(favoriteTeam.teamId || "");

  return (
    normalizeTeamAbbr(game.awayAbbr) === favAbbr ||
    normalizeTeamAbbr(game.homeAbbr) === favAbbr ||
    String(game.awayTeamId || "") === favTeamId ||
    String(game.homeTeamId || "") === favTeamId
  );
}
