import { db, FieldValue } from "../utils.js";
import { fetchMlbLiveFeed } from "./mlbLiveFeed.js";
import { mlbTeamIdFromAbbr } from "./mlbTeamAbbr.js";

const MLB_BOXSCORE_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1/game/${encodeURIComponent(String(gamePk))}/boxscore`;

const MLB_SCHEDULE_URL = ({ teamId, startDate, endDate }) =>
  `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${encodeURIComponent(String(teamId))}` +
  `&startDate=${startDate}&endDate=${endDate}&gameTypes=R`;

const CACHE_COL = "mlb_game_lineups";
const CACHE_TTL_MS = 45 * 60 * 1000;
const CACHE_TTL_EMPTY_MS = 8 * 60 * 1000;
const MIN_LINEUP_SIDE = 5;

function sideLineupKeyCount(lineups, side) {
  if (!lineups || (side !== "away" && side !== "home")) return 0;
  return Object.keys(lineups[side] || {}).length;
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

function str(v) {
  return String(v ?? "").trim();
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

function slotsFromBattingOrder(battingOrder = []) {
  const out = {};
  battingOrder.forEach((rawId, index) => {
    const playerId = str(rawId);
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
  const hasLineups = Object.keys(away).length >= MIN_LINEUP_SIDE || Object.keys(home).length >= MIN_LINEUP_SIDE;
  return { away, home, hasLineups };
}

function parseLineupsFromLiveFeed(json) {
  const teams = json?.liveData?.boxscore?.teams || {};
  const away = slotsFromBattingOrder(teams?.away?.battingOrder || []);
  const home = slotsFromBattingOrder(teams?.home?.battingOrder || []);
  const hasLineups = Object.keys(away).length >= MIN_LINEUP_SIDE || Object.keys(home).length >= MIN_LINEUP_SIDE;
  return { away, home, hasLineups };
}

async function fetchBoxscore(gamePk) {
  const res = await fetch(MLB_BOXSCORE_URL(gamePk), {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchPreviousGameLineupForTeam({ teamAbbr, beforeYmd, excludeGamePk }) {
  const abbr = str(teamAbbr).toUpperCase();
  const teamId = mlbTeamIdFromAbbr(abbr);
  if (!teamId || !beforeYmd) return null;

  const endDate = shiftYmd(beforeYmd, -1) || beforeYmd;
  const startDate = shiftYmd(beforeYmd, -21);
  if (!startDate) return null;

  const res = await fetch(MLB_SCHEDULE_URL({ teamId, startDate, endDate }), {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });
  if (!res.ok) return null;

  const json = await res.json();
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

  const box = await fetchBoxscore(lastGame.gamePk);
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
  const hasLineups =
    Object.keys(awaySlots).length >= MIN_LINEUP_SIDE || Object.keys(homeSlots).length >= MIN_LINEUP_SIDE;
  if (!hasLineups) return null;

  return {
    away: awaySlots,
    home: homeSlots,
    hasLineups: true,
    isProvisional: true,
    source: "previous_game",
    previousGameMeta: {
      away: awayPrev ? { gamePk: awayPrev.sourceGamePk, gameDate: awayPrev.sourceGameDate } : null,
      home: homePrev ? { gamePk: homePrev.sourceGamePk, gameDate: homePrev.sourceGameDate } : null,
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
    source: usedPrevious && source !== "boxscore" && source !== "live_feed" ? "previous_game" : source,
    previousGameMeta,
  };
}

export function lineupSlotForPlayer(lineups, playerId, teamAbbr, homeAbbr, awayAbbr) {
  if (!lineups || !playerId) return null;
  const pid = str(playerId);
  const abbr = str(teamAbbr).toUpperCase();
  const home = str(homeAbbr).toUpperCase();
  const away = str(awayAbbr).toUpperCase();

  if (abbr && abbr === away) {
    return lineups.away?.[pid] ?? null;
  }
  if (abbr && abbr === home) {
    return lineups.home?.[pid] ?? null;
  }
  return lineups.away?.[pid] ?? lineups.home?.[pid] ?? null;
}

/**
 * Note pédagogique first-RBI selon la place dans l'ordre (1–9).
 */
export function firstRbiLineupNote({ lineupSlot, isAwayTeam, lang = "fr" } = {}) {
  const slot = Number(lineupSlot);
  if (!Number.isFinite(slot) || slot < 1 || slot > 9) return null;

  const isFr = lang !== "en";
  const side = isAwayTeam === true ? (isFr ? "haut de 1re" : "top of 1st") : isAwayTeam === false ? (isFr ? "bas de 1re" : "bottom of 1st") : null;

  if (slot === 1) {
    return isFr
      ? `Frappant ${slot}e (${side || "ordre"}) — bases vides : RBI surtout via circuit.`
      : `Batting ${slot}${ordinalEn(slot)} (${side || "order"}) — empty bases: RBI mostly via solo HR.`;
  }
  if (slot === 2) {
    return isFr
      ? `Frappant ${slot}e — plus de chemins si le leadoff monte sur les buts.`
      : `Batting ${slot}${ordinalEn(slot)} — more paths if the leadoff reaches base.`;
  }
  if (slot >= 3 && slot <= 5) {
    return isFr
      ? `Frappant ${slot}e — profil souvent favorable pour le premier RBI si 1-2 mettent des coureurs en jeu.`
      : `Batting ${slot}${ordinalEn(slot)} — often a strong first-RBI profile if 1–2 reach base.`;
  }
  return isFr
    ? `Frappant ${slot}e — doit attendre le haut d'ordre ; risque de ne pas frapper en 1re manche.`
    : `Batting ${slot}${ordinalEn(slot)} — waits for top of order; may not bat in the 1st.`;
}

function ordinalEn(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  const r = n % 10;
  if (r === 1) return "st";
  if (r === 2) return "nd";
  if (r === 3) return "rd";
  return "th";
}

/**
 * Résout les alignements (cache Firestore + boxscore + live feed + dernier match).
 */
export async function resolveMlbGameLineups(gamePk, { awayAbbr, homeAbbr, beforeYmd } = {}) {
  const pk = str(gamePk);
  if (!pk) {
    return { gamePk: null, away: {}, home: {}, hasLineups: false, source: "none" };
  }

  const resolvedBeforeYmd = ymdFromDateInput(beforeYmd) || ymdFromDateInput(new Date());
  const cacheRef = db.doc(`${CACHE_COL}/${pk}`);
  const cacheSnap = await cacheRef.get();

  let away = {};
  let home = {};
  let hasLineups = false;
  let source = "none";
  let isProvisional = false;
  let previousGameMeta = null;

  if (cacheSnap.exists) {
    const cached = cacheSnap.data() || {};
    const exp = cached.expiresAt?.toDate?.()?.getTime?.() || 0;
    if (exp > Date.now() && cached.hasLineups === true) {
      away = cached.away || {};
      home = cached.home || {};
      hasLineups = true;
      source = cached.source || "cache";
      isProvisional = cached.isProvisional === true;
      previousGameMeta = cached.previousGameMeta || null;
    }
  }

  if (!hasLineups) {
    try {
      const box = await fetchBoxscore(pk);
      if (box) {
        const parsed = parseLineupsFromBoxscoreJson(box);
        away = parsed.away;
        home = parsed.home;
        hasLineups = parsed.hasLineups;
        if (hasLineups) source = "boxscore";
      }
    } catch {
      // fallback live feed
    }

    if (!hasLineups) {
      try {
        const live = await fetchMlbLiveFeed(pk);
        const parsed = parseLineupsFromLiveFeed(live);
        away = parsed.away;
        home = parsed.home;
        hasLineups = parsed.hasLineups;
        if (hasLineups) source = "live_feed";
      } catch {
        // keep empty
      }
    }

    if (!hasLineups) {
      const previous = await fetchPreviousGameLineupsFallback({
        gamePk: pk,
        awayAbbr,
        homeAbbr,
        beforeYmd: resolvedBeforeYmd,
      });
      if (previous) {
        away = previous.away;
        home = previous.home;
        hasLineups = true;
        source = previous.source;
        isProvisional = previous.isProvisional === true;
        previousGameMeta = previous.previousGameMeta || null;
      }
    }
  }

  let result = {
    gamePk: pk,
    away,
    home,
    hasLineups,
    source,
    isProvisional,
    previousGameMeta,
  };

  result = await fillMissingLineupSides(result, {
    gamePk: pk,
    awayAbbr,
    homeAbbr,
    beforeYmd: resolvedBeforeYmd,
  });

  const ttl = result.hasLineups ? CACHE_TTL_MS : CACHE_TTL_EMPTY_MS;
  await cacheRef.set(
    {
      gamePk: pk,
      away: result.away,
      home: result.home,
      hasLineups: result.hasLineups,
      source: result.source,
      isProvisional: result.isProvisional === true,
      previousGameMeta: result.previousGameMeta,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + ttl),
    },
    { merge: true }
  );

  return result;
}
