// functions/firstGoalChallenge/novaFgcPickAtLock.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";
import { getMlbCurrentSeason } from "../players/seasonHelpers.js";

const NOVA_UID = "ai";
const NOVA_DISPLAY_NAME = "Nova";
const LOCK_MINUTES_BEFORE = 15;
const FGC_CUTOFF_MINUTES = 5;
const NOVA_POT_BONUS_DEFAULT = 1;
const GETALL_CHUNK = 400;
const MAX_CANDIDATES = 120;

function safeNum(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function str(v) {
  return String(v ?? "").trim();
}

function safeAbbr(v) {
  return str(v).toUpperCase();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getNhlSeasonId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
}

function isInjuredOrUnavailable(injury) {
  const raw = str(injury?.status).toLowerCase();
  if (!raw) return false;
  if (raw === "active") return false;
  return true;
}

function isSkaterPosition(positionCode, league) {
  const pos = safeAbbr(positionCode);
  if (!pos) return true;
  if (league === "NHL") return pos !== "G";
  return !["P", "SP", "RP", "CP"].includes(pos);
}

function getNovaPotBonus(challenge = {}) {
  const raw = challenge?.novaPotBonus ?? challenge?.potJoinIncrement ?? NOVA_POT_BONUS_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : NOVA_POT_BONUS_DEFAULT;
}

async function loadNhlCandidates(homeAbbr, awayAbbr, seasonId) {
  const teams = [homeAbbr, awayAbbr].filter(Boolean);
  if (teams.length < 2) return [];

  const snap = await db
    .collection("nhl_players")
    .where("teamAbbr", "in", teams)
    .where("active", "==", true)
    .get();

  const players = [];
  snap.forEach((doc) => {
    const p = doc.data() || {};
    const playerId = str(p.playerId ?? p.id ?? doc.id);
    const teamAbbr = safeAbbr(p.teamAbbr);
    if (!playerId || !teams.includes(teamAbbr)) return;
    if (!isSkaterPosition(p.position || p.positionCode, "NHL")) return;
    if (isInjuredOrUnavailable(p.injury)) return;

    players.push({
      playerId,
      fullName: str(p.fullName || p.skaterFullName || p.name) || playerId,
      teamAbbr,
      positionCode: str(p.position || p.positionCode) || null,
      headshotUrl: str(p.headshotUrl || p.photoUrl) || null,
      goals: 0,
      pointsPerGame: 0,
      scoreNovaBase: 0,
    });
  });

  if (!players.length) return [];

  const statsMap = new Map();
  const refs = players.map((p) => db.doc(`nhl_player_stats_current/${seasonId}_${p.playerId}`));
  for (const refChunk of chunk(refs, GETALL_CHUNK)) {
    const snaps = await db.getAll(...refChunk);
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data() || {};
      const pid = str(d.playerId);
      if (!pid) continue;
      const goals = safeNum(d.goals, 0);
      const gamesPlayed = safeNum(d.gamesPlayed, 0);
      const points = safeNum(d.points, safeNum(d.goals, 0) + safeNum(d.assists, 0));
      const pointsPerGame = safeNum(
        d.pointsPerGame,
        gamesPlayed > 0 ? points / gamesPlayed : 0
      );
      statsMap.set(pid, { goals, pointsPerGame, scoreNovaBase: goals });
    }
  }

  return players
    .map((p) => {
      const st = statsMap.get(p.playerId) || {};
      return {
        ...p,
        goals: safeNum(st.goals, 0),
        pointsPerGame: safeNum(st.pointsPerGame, 0),
        scoreNovaBase: safeNum(st.scoreNovaBase, safeNum(st.goals, 0)),
      };
    })
    .sort((a, b) => {
      const dg = safeNum(b.goals, 0) - safeNum(a.goals, 0);
      if (dg) return dg;
      const dppg = safeNum(b.pointsPerGame, 0) - safeNum(a.pointsPerGame, 0);
      if (dppg) return dppg;
      return String(a.fullName).localeCompare(String(b.fullName));
    })
    .slice(0, MAX_CANDIDATES);
}

async function loadMlbCandidates(homeAbbr, awayAbbr, seasonId) {
  const teams = [homeAbbr, awayAbbr].filter(Boolean);
  if (teams.length < 2) return [];

  const snap = await db
    .collection("mlb_players")
    .where("teamAbbr", "in", teams)
    .where("active", "==", true)
    .get();

  const players = [];
  snap.forEach((doc) => {
    const p = doc.data() || {};
    const playerId = str(p.playerId ?? p.id ?? doc.id);
    const teamAbbr = safeAbbr(p.teamAbbr);
    if (!playerId || !teams.includes(teamAbbr)) return;
    if (!isSkaterPosition(p.position || p.positionCode, "MLB")) return;
    if (isInjuredOrUnavailable(p.injury)) return;

    players.push({
      playerId,
      fullName: str(p.fullName || p.name) || playerId,
      teamAbbr,
      positionCode: str(p.position || p.positionCode) || null,
      headshotUrl: str(p.headshotUrl || p.photoUrl) || null,
      rbi: 0,
      pointsPerGame: 0,
      scoreNovaBase: 0,
    });
  });

  if (!players.length) return [];

  const statsMap = new Map();
  const refs = players.map((p) => db.doc(`mlb_player_stats_current/${seasonId}_${p.playerId}`));
  for (const refChunk of chunk(refs, GETALL_CHUNK)) {
    const snaps = await db.getAll(...refChunk);
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data() || {};
      const pid = str(d.playerId);
      if (!pid) continue;
      const rbi = safeNum(d.rbi, 0);
      const pointsPerGame = safeNum(d.pointsPerGame, 0);
      statsMap.set(pid, { rbi, pointsPerGame, scoreNovaBase: rbi || pointsPerGame });
    }
  }

  return players
    .map((p) => {
      const st = statsMap.get(p.playerId) || {};
      return {
        ...p,
        rbi: safeNum(st.rbi, 0),
        pointsPerGame: safeNum(st.pointsPerGame, 0),
        scoreNovaBase: safeNum(st.scoreNovaBase, safeNum(st.rbi, 0)),
      };
    })
    .sort((a, b) => {
      const dr = safeNum(b.rbi, 0) - safeNum(a.rbi, 0);
      if (dr) return dr;
      const dppg = safeNum(b.pointsPerGame, 0) - safeNum(a.pointsPerGame, 0);
      if (dppg) return dppg;
      return String(a.fullName).localeCompare(String(b.fullName));
    })
    .slice(0, MAX_CANDIDATES);
}

async function loadCandidatesForChallenge(challenge = {}) {
  const league = safeAbbr(challenge.league || "NHL") === "MLB" ? "MLB" : "NHL";
  const homeAbbr = safeAbbr(challenge.homeAbbr);
  const awayAbbr = safeAbbr(challenge.awayAbbr);
  const start = challenge.gameStartTimeUTC?.toDate?.() || null;

  if (league === "MLB") {
    const seasonId = getMlbCurrentSeason(start || new Date());
    return loadMlbCandidates(homeAbbr, awayAbbr, seasonId);
  }

  const seasonId = getNhlSeasonId(start || new Date());
  return loadNhlCandidates(homeAbbr, awayAbbr, seasonId);
}

export const novaFgcPickAtLock = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    const nowMs = Date.now();
    const lockMs = LOCK_MINUTES_BEFORE * 60 * 1000;
    const cutoffMs = FGC_CUTOFF_MINUTES * 60 * 1000;

    const qs = await db
      .collection("first_goal_challenges")
      .where("status", "==", "open")
      .limit(80)
      .get();

    if (qs.empty) return;

    let processed = 0;

    for (const doc of qs.docs) {
      const challengeId = doc.id;
      const challenge = doc.data() || {};
      const start = challenge.gameStartTimeUTC?.toDate?.();
      if (!start) continue;

      const startMs = start.getTime();
      const lockAtMs = startMs - lockMs;
      const cutoffAtMs = startMs - cutoffMs;

      if (nowMs < lockAtMs) continue;
      if (nowMs >= cutoffAtMs) continue;

      if (challenge.novaLockedAt) continue;

      const entryRef = db.doc(`first_goal_challenges/${challengeId}/entries/${NOVA_UID}`);
      const existingEntry = await entryRef.get();
      if (existingEntry.exists && str(existingEntry.data()?.playerId)) continue;

      const candidates = await loadCandidatesForChallenge(challenge);
      const pick = candidates[0] || null;

      if (!pick) {
        await doc.ref.set(
          {
            novaLockedAt: FieldValue.serverTimestamp(),
            novaError: "no_healthy_players_for_fgc",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        logger.warn("[novaFgcPickAtLock] no pick available", { challengeId });
        continue;
      }

      const potBonus = getNovaPotBonus(challenge);
      const chRef = doc.ref;

      await db.runTransaction(async (tx) => {
        const chSnap = await tx.get(chRef);
        if (!chSnap.exists) return;

        const ch = chSnap.data() || {};
        if (String(ch.status || "").toLowerCase() !== "open") return;
        if (ch.novaLockedAt) return;

        const partSnap = await tx.get(entryRef);
        if (partSnap.exists && str(partSnap.data()?.playerId)) return;

        const isFirstParticipation = !partSnap.exists || !str(partSnap.data()?.playerId);

        tx.set(
          entryRef,
          {
            uid: NOVA_UID,
            type: "ai",
            displayName: NOVA_DISPLAY_NAME,
            avatarUrl: null,
            playerId: String(pick.playerId),
            playerName: pick.fullName,
            teamAbbr: pick.teamAbbr,
            positionCode: pick.positionCode,
            headshotUrl: pick.headshotUrl,
            paid: true,
            paidAmount: potBonus,
            sponsoredBy: "prophetik",
            pickedBy: NOVA_UID,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const chPatch = {
          novaLockedAt: FieldValue.serverTimestamp(),
          novaPickPlayerId: String(pick.playerId),
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (isFirstParticipation) {
          chPatch.participantsCount = FieldValue.increment(1);
          chPatch.pot = FieldValue.increment(potBonus);
        }

        tx.set(chRef, chPatch, { merge: true });
      });

      processed += 1;
      logger.info("[novaFgcPickAtLock] picked", {
        challengeId,
        playerId: pick.playerId,
        playerName: pick.fullName,
        potBonus,
      });
    }

    if (processed > 0) {
      logger.info("[novaFgcPickAtLock] done", { processed });
    }
  }
);
