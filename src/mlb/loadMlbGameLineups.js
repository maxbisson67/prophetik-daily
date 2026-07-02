import functions from "@react-native-firebase/functions";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

const MLB_BOXSCORE_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1/game/${encodeURIComponent(String(gamePk))}/boxscore`;

const MLB_LIVE_FEED_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(String(gamePk))}/feed/live`;

function str(v) {
  return String(v ?? "").trim();
}

function normalizePlayerId(raw) {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    return n > 0 ? String(n) : "";
  }
  const id = str(raw);
  return /^\d+$/.test(id) ? id : "";
}

export function playerIdsForLineupLookup(player) {
  const ids = new Set();
  for (const raw of [player?.playerId, player?.id, player?.mlbId, player?.personId]) {
    const id = normalizePlayerId(raw);
    if (id) ids.add(id);
  }
  return [...ids];
}

function slotsFromBattingOrder(battingOrder = []) {
  const out = {};
  battingOrder.forEach((rawId, index) => {
    const playerId = normalizePlayerId(rawId);
    if (!playerId) return;
    out[playerId] = index + 1;
  });
  return out;
}

function parseLineupsFromBoxscoreJson(json) {
  const awayOrder = json?.teams?.away?.battingOrder || [];
  const homeOrder = json?.teams?.home?.battingOrder || [];
  const away = slotsFromBattingOrder(awayOrder);
  const home = slotsFromBattingOrder(homeOrder);
  const hasLineups = Object.keys(away).length >= 5 || Object.keys(home).length >= 5;
  return { away, home, hasLineups };
}

export function hasUsableMlbLineups(lineups) {
  if (!lineups || typeof lineups !== "object") return false;
  if (lineups.hasLineups === true) return true;
  const away = Object.keys(lineups.away || {}).length;
  const home = Object.keys(lineups.home || {}).length;
  return away >= 5 || home >= 5;
}

const MIN_LINEUP_SIDE = 5;

export function sideLineupKeyCount(lineups, side) {
  if (!lineups || (side !== "away" && side !== "home")) return 0;
  return Object.keys(lineups[side] || {}).length;
}

export function hasLineupDataForTeam(lineups, teamAbbr, homeAbbr, awayAbbr) {
  const team = str(teamAbbr).toUpperCase();
  const home = str(homeAbbr).toUpperCase();
  const away = str(awayAbbr).toUpperCase();
  if (team === away) return sideLineupKeyCount(lineups, "away") >= MIN_LINEUP_SIDE;
  if (team === home) return sideLineupKeyCount(lineups, "home") >= MIN_LINEUP_SIDE;
  return false;
}

function resolveTeamSideFromBox(box, teamAbbr, teamId) {
  const abbr = str(teamAbbr).toUpperCase();
  const id = str(teamId);
  for (const side of ["away", "home"]) {
    const t = box?.teams?.[side]?.team || {};
    const apiAbbr = str(t?.abbreviation || t?.teamCode).toUpperCase();
    const apiId = t?.id != null ? str(t.id) : "";
    if (abbr && apiAbbr === abbr) return side;
    if (id && apiId === id) return side;
  }
  return null;
}

export function isOfficialMlbLineup(lineups) {
  if (!hasUsableMlbLineups(lineups)) return false;
  if (lineups.isProvisional === true) return false;
  return lineups.source !== "previous_game";
}

export function isProvisionalMlbLineup(lineups) {
  return (
    hasUsableMlbLineups(lineups) &&
    (lineups.isProvisional === true || lineups.source === "previous_game")
  );
}

function ymdFromDateInput(value) {
  if (!value) return null;
  const raw = str(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftYmd(ymd, deltaDays) {
  const s = str(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return ymdFromDateInput(d);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchMlbLineupsDirectFromApi(gamePk) {
  const pk = str(gamePk);
  if (!pk) {
    return { away: {}, home: {}, hasLineups: false, source: null };
  }

  try {
    const box = await fetchJson(MLB_BOXSCORE_URL(pk));
    if (box) {
      const parsed = parseLineupsFromBoxscoreJson(box);
      if (parsed.hasLineups) {
        return {
          away: parsed.away,
          home: parsed.home,
          hasLineups: true,
          source: "boxscore_direct",
        };
      }
    }

    const live = await fetchJson(MLB_LIVE_FEED_URL(pk));
    if (live) {
      const teams = live?.liveData?.boxscore?.teams || {};
      const away = slotsFromBattingOrder(teams?.away?.battingOrder || []);
      const home = slotsFromBattingOrder(teams?.home?.battingOrder || []);
      const hasLineups = Object.keys(away).length >= 5 || Object.keys(home).length >= 5;
      if (hasLineups) {
        return { away, home, hasLineups: true, source: "live_feed_direct" };
      }
    }
  } catch (e) {
    if (__DEV__) {
      console.log("[loadMlbLineups] direct fetch failed", e?.message || e);
    }
  }

  return { away: {}, home: {}, hasLineups: false, source: null };
}

async function fetchPreviousGameLineupForTeam({ teamAbbr, beforeYmd, excludeGamePk }) {
  const abbr = str(teamAbbr).toUpperCase();
  const team = lookupTeamByAbbr("MLB", abbr);
  const teamId = str(team?.teamId);
  if (!teamId || !beforeYmd) return null;

  const endDate = shiftYmd(beforeYmd, -1) || beforeYmd;
  const startDate = shiftYmd(beforeYmd, -21);
  if (!startDate) return null;

  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${encodeURIComponent(teamId)}` +
    `&startDate=${startDate}&endDate=${endDate}&gameTypes=R`;

  const json = await fetchJson(url);
  const finals = [];

  for (const day of json?.dates || []) {
    for (const game of day?.games || []) {
      if (str(game?.gamePk) === str(excludeGamePk)) continue;
      if (game?.status?.abstractGameState !== "Final") continue;
      finals.push(game);
    }
  }

  finals.sort((a, b) => new Date(b?.gameDate || 0) - new Date(a?.gameDate || 0));
  const lastGame = finals[0];
  if (!lastGame?.gamePk) return null;

  const box = await fetchJson(MLB_BOXSCORE_URL(lastGame.gamePk));
  if (!box) return null;

  const side = resolveTeamSideFromBox(box, abbr, teamId);
  if (!side) return null;

  const slots = slotsFromBattingOrder(box?.teams?.[side]?.battingOrder || []);
  if (Object.keys(slots).length < MIN_LINEUP_SIDE) return null;

  return {
    slots,
    sourceGamePk: str(lastGame.gamePk),
    sourceGameDate: lastGame.gameDate || null,
  };
}

async function fetchPreviousGameLineupsFallback({ gamePk, awayAbbr, homeAbbr, beforeYmd }) {
  const away = str(awayAbbr).toUpperCase();
  const home = str(homeAbbr).toUpperCase();
  const before = ymdFromDateInput(beforeYmd);
  if (!away || !home || !before) return null;

  const [awayPrev, homePrev] = await Promise.all([
    fetchPreviousGameLineupForTeam({ teamAbbr: away, beforeYmd: before, excludeGamePk: gamePk }),
    fetchPreviousGameLineupForTeam({ teamAbbr: home, beforeYmd: before, excludeGamePk: gamePk }),
  ]);

  const awaySlots = awayPrev?.slots || {};
  const homeSlots = homePrev?.slots || {};
  const hasLineups = Object.keys(awaySlots).length >= MIN_LINEUP_SIDE || Object.keys(homeSlots).length >= MIN_LINEUP_SIDE;
  if (!hasLineups) return null;

  return {
    away: awaySlots,
    home: homeSlots,
    hasLineups: true,
    isProvisional: true,
    source: "previous_game",
    previousGameMeta: {
      away: awayPrev
        ? { gamePk: awayPrev.sourceGamePk, gameDate: awayPrev.sourceGameDate }
        : null,
      home: homePrev
        ? { gamePk: homePrev.sourceGamePk, gameDate: homePrev.sourceGameDate }
        : null,
    },
  };
}

async function fillMissingLineupSides(result, { gamePk, awayAbbr, homeAbbr, beforeYmd }) {
  const base = result && typeof result === "object" ? result : {};
  let away = { ...(base.away || {}) };
  let home = { ...(base.home || {}) };
  let changed = false;

  const before = ymdFromDateInput(beforeYmd) || ymdFromDateInput(new Date());
  const awayU = str(awayAbbr).toUpperCase();
  const homeU = str(homeAbbr).toUpperCase();
  const previousGameMeta = {
    away: base.previousGameMeta?.away || null,
    home: base.previousGameMeta?.home || null,
  };

  if (awayU && sideLineupKeyCount({ away }, "away") < MIN_LINEUP_SIDE) {
    const prev = await fetchPreviousGameLineupForTeam({
      teamAbbr: awayU,
      beforeYmd: before,
      excludeGamePk: gamePk,
    });
    if (prev?.slots && Object.keys(prev.slots).length >= MIN_LINEUP_SIDE) {
      away = prev.slots;
      previousGameMeta.away = { gamePk: prev.sourceGamePk, gameDate: prev.sourceGameDate };
      changed = true;
    }
  }

  if (homeU && sideLineupKeyCount({ home }, "home") < MIN_LINEUP_SIDE) {
    const prev = await fetchPreviousGameLineupForTeam({
      teamAbbr: homeU,
      beforeYmd: before,
      excludeGamePk: gamePk,
    });
    if (prev?.slots && Object.keys(prev.slots).length >= MIN_LINEUP_SIDE) {
      home = prev.slots;
      previousGameMeta.home = { gamePk: prev.sourceGamePk, gameDate: prev.sourceGameDate };
      changed = true;
    }
  }

  if (!changed) return base;

  const hasLineups =
    sideLineupKeyCount({ away }, "away") >= MIN_LINEUP_SIDE ||
    sideLineupKeyCount({ home }, "home") >= MIN_LINEUP_SIDE;

  const source = base.source || null;
  const usedPrevious = source === "previous_game" || changed;

  return {
    ...base,
    away,
    home,
    hasLineups,
    isProvisional: base.isProvisional === true || usedPrevious,
    source: usedPrevious && source !== "boxscore_direct" && source !== "live_feed_direct" ? "previous_game" : source,
    previousGameMeta,
  };
}

/**
 * Charge l'ordre de frappe (1–9) pour un match MLB (callable + repli API MLB + dernier match).
 */
export async function loadMlbGameLineups(
  gamePk,
  { awayAbbr, homeAbbr, beforeYmd } = {}
) {
  const pk = str(gamePk);
  if (!pk) {
    return { away: {}, home: {}, hasLineups: false, source: null };
  }

  let result = { away: {}, home: {}, hasLineups: false, source: null };

  try {
    const call = functions().httpsCallable("prefetchMlbLineups");
    const res = await call({ gamePk: pk });
    result = {
      away: res?.data?.away || {},
      home: res?.data?.home || {},
      hasLineups: res?.data?.hasLineups === true,
      source: res?.data?.source || null,
    };
  } catch (e) {
    if (__DEV__) {
      console.log("[loadMlbLineups] prefetch failed", e?.message || e);
    }
  }

  if (!hasUsableMlbLineups(result)) {
    const direct = await fetchMlbLineupsDirectFromApi(pk);
    if (hasUsableMlbLineups(direct)) {
      result = direct;
    }
  }

  if (!hasUsableMlbLineups(result)) {
    const resolvedBeforeYmd =
      ymdFromDateInput(beforeYmd) || ymdFromDateInput(new Date());
    const previous = await fetchPreviousGameLineupsFallback({
      gamePk: pk,
      awayAbbr,
      homeAbbr,
      beforeYmd: resolvedBeforeYmd,
    });
    if (previous) {
      result = previous;
    }
  }

  const resolvedBeforeYmd = ymdFromDateInput(beforeYmd) || ymdFromDateInput(new Date());
  result = await fillMissingLineupSides(result, {
    gamePk: pk,
    awayAbbr,
    homeAbbr,
    beforeYmd: resolvedBeforeYmd,
  });

  return result;
}

function slotFromSideMap(sideMap, playerIds = []) {
  if (!sideMap || typeof sideMap !== "object") return null;
  for (const pid of playerIds) {
    const slot = sideMap[pid];
    if (slot != null) return Number(slot);
  }
  return null;
}

export function lineupSlotForPlayer(lineups, player, homeAbbr, awayAbbr) {
  if (!lineups) return null;

  const playerIds = playerIdsForLineupLookup(player);
  if (!playerIds.length) return null;

  const teamAbbr = str(player?.teamAbbr).toUpperCase();
  const home = str(homeAbbr).toUpperCase();
  const away = str(awayAbbr).toUpperCase();

  if (teamAbbr === away) {
    const slot = slotFromSideMap(lineups.away, playerIds);
    return slot != null ? slot : null;
  }
  if (teamAbbr === home) {
    const slot = slotFromSideMap(lineups.home, playerIds);
    return slot != null ? slot : null;
  }

  const slot =
    slotFromSideMap(lineups.away, playerIds) ?? slotFromSideMap(lineups.home, playerIds);
  return slot != null ? slot : null;
}

export function enrichPlayersWithMlbLineups(players = [], lineups, homeAbbr, awayAbbr) {
  if (!hasUsableMlbLineups(lineups) || !Array.isArray(players)) return players;

  return players.map((p) => {
    const lineupSlot = lineupSlotForPlayer(lineups, p, homeAbbr, awayAbbr);
    return lineupSlot != null ? { ...p, lineupSlot } : p;
  });
}
