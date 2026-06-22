/**
 * Stats live TS MLB — hits + RBI + bonus HR par joueur (par journée).
 */
import { logger } from "firebase-functions";
import { db, FieldValue } from "../utils.js";
import { isMlbScheduleGameSelectable } from "../mlb/mlbGameStatus.js";

const MLB_LIVE_FEED_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(String(gamePk))}/feed/live`;

function ymdCompact(ymd) {
  return String(ymd || "").slice(0, 10).replace(/-/g, "");
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function mlbPlayerTsPoints({ hits = 0, rbi = 0, homeRuns = 0 } = {}) {
  return num(hits) + num(rbi) + num(homeRuns);
}

export function aggregateMlbBattingFromLiveFeed(liveFeed) {
  const hitsByPlayer = new Map();
  const rbiByPlayer = new Map();
  const hrByPlayer = new Map();
  const pointsByPlayer = new Map();

  const teams = liveFeed?.liveData?.boxscore?.teams || {};

  for (const side of ["home", "away"]) {
    const players = teams[side]?.players || {};
    for (const key of Object.keys(players)) {
      const p = players[key] || {};
      const playerId = String(p?.person?.id || "").trim();
      if (!playerId) continue;

      const batting = p?.stats?.batting || {};
      const hits = num(batting.hits);
      const rbi = num(batting.rbi);
      const homeRuns = num(batting.homeRuns);

      if (hits === 0 && rbi === 0 && homeRuns === 0) continue;

      hitsByPlayer.set(playerId, (hitsByPlayer.get(playerId) || 0) + hits);
      rbiByPlayer.set(playerId, (rbiByPlayer.get(playerId) || 0) + rbi);
      hrByPlayer.set(playerId, (hrByPlayer.get(playerId) || 0) + homeRuns);
      pointsByPlayer.set(
        playerId,
        (pointsByPlayer.get(playerId) || 0) + mlbPlayerTsPoints({ hits, rbi, homeRuns })
      );
    }
  }

  return { hitsByPlayer, rbiByPlayer, hrByPlayer, pointsByPlayer };
}

function cleanObj(mapOrObj) {
  const entries =
    mapOrObj instanceof Map
      ? Array.from(mapOrObj.entries())
      : Object.entries(mapOrObj || {});
  return Object.fromEntries(entries.filter(([, v]) => Number(v) > 0));
}

async function fetchMlbLiveFeed(gamePk) {
  const url = MLB_LIVE_FEED_URL(gamePk);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });
  if (!res.ok) throw new Error(`MLB live feed ${res.status} gamePk=${gamePk}`);
  return res.json();
}

export async function loadMlbGamePksForYmd(ymd) {
  const snapId = ymdCompact(ymd);
  const snap = await db.collection(`mlb_schedule_daily/${snapId}/games`).get();
  const pks = [];

  snap.forEach((doc) => {
    const g = doc.data() || {};
    if (!isMlbScheduleGameSelectable(g)) return;
    const gamePk = String(g?.gamePk ?? doc.id ?? "").trim();
    if (gamePk) pks.push(gamePk);
  });

  return pks;
}

export async function aggregateMlbDayBattingStats(ymd) {
  const gamePks = await loadMlbGamePksForYmd(ymd);
  const hitsByPlayer = new Map();
  const rbiByPlayer = new Map();
  const hrByPlayer = new Map();
  const pointsByPlayer = new Map();

  const mergeMaps = (target, source) => {
    for (const [k, v] of source.entries()) {
      target.set(k, (target.get(k) || 0) + v);
    }
  };

  for (const gamePk of gamePks) {
    try {
      const feed = await fetchMlbLiveFeed(gamePk);
      const agg = aggregateMlbBattingFromLiveFeed(feed);
      mergeMaps(hitsByPlayer, agg.hitsByPlayer);
      mergeMaps(rbiByPlayer, agg.rbiByPlayer);
      mergeMaps(hrByPlayer, agg.hrByPlayer);
      mergeMaps(pointsByPlayer, agg.pointsByPlayer);
    } catch (e) {
      logger.warn("[mlbDefiLiveStats] feed failed", {
        ymd,
        gamePk,
        err: String(e?.message || e),
      });
    }
  }

  return {
    playerHits: cleanObj(hitsByPlayer),
    playerRbi: cleanObj(rbiByPlayer),
    playerHomeRuns: cleanObj(hrByPlayer),
    playerPoints: cleanObj(pointsByPlayer),
  };
}

export async function updateMlbParticipationLivePoints(defiRef, pointsObj) {
  const parts = await defiRef.collection("participations").get();
  const bw = db.bulkWriter();

  for (const pSnap of parts.docs) {
    const p = pSnap.data() || {};
    const picks = Array.isArray(p.picks) ? p.picks : [];
    let pts = 0;

    for (const pick of picks) {
      const raw = pick?.playerId ?? pick?.id ?? pick?.player?.id;
      if (!raw) continue;
      pts += Number(pointsObj[String(raw).trim()] ?? 0);
    }

    bw.update(pSnap.ref, {
      livePoints: pts,
      liveUpdatedAt: FieldValue.serverTimestamp(),
    });
  }

  await bw.close();
}
