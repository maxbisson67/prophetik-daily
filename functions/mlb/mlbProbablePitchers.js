import * as logger from "firebase-functions/logger";
import { getMlbCurrentSeason } from "../players/seasonHelpers.js";
import { normalizeHand } from "./mlbPersonHands.js";

export const EMPTY_MLB_PITCHER = Object.freeze({
  id: null,
  name: null,
  wins: null,
  losses: null,
  era: null,
});

const MLB_PEOPLE_STATS_URL = (playerId, season) =>
  `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=pitching&season=${season}`;

const MLB_SCHEDULE_GAME_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePk=${encodeURIComponent(String(gamePk))}&hydrate=probablePitcher`;

export function buildEmptyMlbPitcher() {
  return { ...EMPTY_MLB_PITCHER };
}

function toNumOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickPitcherField(primary, fallback, field) {
  const a = primary?.[field];
  const b = fallback?.[field];
  if (a !== null && a !== undefined && a !== "") return a;
  if (b !== null && b !== undefined && b !== "") return b;
  return null;
}

function resolveNodePersonId(node) {
  if (!node || typeof node !== "object") return null;
  for (const key of ["id", "playerId", "personId", "pitcherId"]) {
    const id = toNumOrNull(node[key]);
    if (id) return id;
  }
  return null;
}

function toEraString(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function pickPitchingSplit(payload) {
  const groups = Array.isArray(payload?.stats) ? payload.stats : [];
  for (const group of groups) {
    const splits = Array.isArray(group?.splits) ? group.splits : [];
    if (splits.length) return splits[0]?.stat || null;
  }
  return null;
}

function extractStatsFromProbableNode(node) {
  if (!node || typeof node !== "object") {
    return { wins: null, losses: null, era: null };
  }

  const stat =
    node?.seasonStats?.[0]?.stat ||
    node?.stats?.[0]?.splits?.[0]?.stat ||
    node?.stat ||
    null;

  if (!stat) {
    return { wins: null, losses: null, era: null };
  }

  return {
    wins: toNumOrNull(stat.wins),
    losses: toNumOrNull(stat.losses),
    era: toEraString(stat.era),
  };
}

export function normalizeProbablePitcherNode(node) {
  if (!node || typeof node !== "object") return buildEmptyMlbPitcher();

  const id = resolveNodePersonId(node);
  const name =
    (typeof node.fullName === "string" && node.fullName.trim()) ||
    (typeof node.name === "string" && node.name.trim()) ||
    null;

  const embedded = extractStatsFromProbableNode(node);
  const throwHand = normalizeHand(node.throwHand || node.pitchHand?.code || node.pitchHand);

  return {
    id,
    name,
    wins: embedded.wins,
    losses: embedded.losses,
    era: embedded.era,
    throwHand,
  };
}

/** Fusionne lanceur partant (priorité ID schedule/API, stats challenge). */
export function mergeProbablePitcherRecord(fromChallenge, fromSchedule) {
  const schedule = normalizeProbablePitcherNode(fromSchedule);
  const challenge = normalizeProbablePitcherNode(fromChallenge);

  const id = schedule.id ?? challenge.id ?? null;
  const name = challenge.name || schedule.name || null;

  if (!id && !name) return buildEmptyMlbPitcher();

  const throwHand = schedule.throwHand || challenge.throwHand || null;

  return {
    id,
    name,
    wins: pickPitcherField(challenge, schedule, "wins"),
    losses: pickPitcherField(challenge, schedule, "losses"),
    era: pickPitcherField(challenge, schedule, "era"),
    throwHand,
  };
}

export function pitcherRecordHasId(pitcher) {
  return resolveNodePersonId(pitcher) != null;
}

export async function getMlbPitcherSeasonStats(playerId, season, cache = new Map()) {
  const pk = String(playerId || "").trim();
  const seasonKey = String(season || getMlbCurrentSeason()).trim();

  if (!pk) return buildEmptyMlbPitcher();

  const cacheKey = `${seasonKey}_${pk}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const empty = {
    ...buildEmptyMlbPitcher(),
    id: toNumOrNull(pk),
  };

  try {
    const res = await fetch(MLB_PEOPLE_STATS_URL(pk, seasonKey), {
      headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
    });

    if (!res.ok) {
      cache.set(cacheKey, empty);
      return empty;
    }

    const payload = await res.json();
    const stat = pickPitchingSplit(payload);
    const person = payload?.people?.[0] || null;
    const throwHand = normalizeHand(person?.pitchHand?.code);

    const result = {
      id: toNumOrNull(pk),
      name:
        (typeof person?.fullName === "string" && person.fullName.trim()) ||
        (typeof person?.name === "string" && person.name.trim()) ||
        null,
      wins: toNumOrNull(stat?.wins),
      losses: toNumOrNull(stat?.losses),
      era: toEraString(stat?.era),
      throwHand,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (e) {
    logger.warn("[MLB PITCHERS] stats fetch failed", {
      playerId: pk,
      season: seasonKey,
      err: String(e?.message || e),
    });
    cache.set(cacheKey, empty);
    return empty;
  }
}

export async function resolveProbablePitcher(node, season, cache = new Map()) {
  const base = normalizeProbablePitcherNode(node);
  if (!base.id) return buildEmptyMlbPitcher();

  const hasStats =
    base.wins !== null && base.losses !== null && base.era !== null;

  if (hasStats) return base;

  const fetched = await getMlbPitcherSeasonStats(base.id, season, cache);

  return {
    id: base.id,
    name: base.name || fetched.name || null,
    wins: fetched.wins ?? base.wins,
    losses: fetched.losses ?? base.losses,
    era: fetched.era ?? base.era,
    throwHand: base.throwHand || fetched.throwHand || null,
  };
}

export async function fetchProbablePitchersForGamePk(gamePk, season, cache = new Map()) {
  const pk = String(gamePk || "").trim();
  if (!pk) {
    return { away: buildEmptyMlbPitcher(), home: buildEmptyMlbPitcher() };
  }

  try {
    const res = await fetch(MLB_SCHEDULE_GAME_URL(pk), {
      headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
    });
    if (!res.ok) {
      return { away: buildEmptyMlbPitcher(), home: buildEmptyMlbPitcher() };
    }

    const json = await res.json();
    const rawGame = json?.dates?.[0]?.games?.[0] || null;
    if (!rawGame) {
      return { away: buildEmptyMlbPitcher(), home: buildEmptyMlbPitcher() };
    }

    const { awayProbablePitcher, homeProbablePitcher } = await enrichRawMlbGamePitchers(
      rawGame,
      season,
      cache
    );

    return { away: awayProbablePitcher, home: homeProbablePitcher };
  } catch (e) {
    logger.warn("[MLB PITCHERS] schedule gamePk fetch failed", {
      gamePk: pk,
      err: String(e?.message || e),
    });
    return { away: buildEmptyMlbPitcher(), home: buildEmptyMlbPitcher() };
  }
}

export async function enrichRawMlbGamePitchers(rawGame, season, cache = new Map()) {
  const awayNode = rawGame?.teams?.away?.probablePitcher || null;
  const homeNode = rawGame?.teams?.home?.probablePitcher || null;

  const [awayProbablePitcher, homeProbablePitcher] = await Promise.all([
    resolveProbablePitcher(awayNode, season, cache),
    resolveProbablePitcher(homeNode, season, cache),
  ]);

  return { awayProbablePitcher, homeProbablePitcher };
}

export function formatPitcherLogLine(abbr, pitcher) {
  const team = String(abbr || "").toUpperCase() || "?";
  if (!pitcher?.name) return `${team}: (lanceur à confirmer)`;

  const wl =
    pitcher.wins !== null && pitcher.losses !== null
      ? `${pitcher.wins}-${pitcher.losses}`
      : "—";

  const era = pitcher.era ? `ERA ${pitcher.era}` : "ERA —";
  return `${team}: ${pitcher.name} ${wl} ${era}`;
}

export function logMlbPitchersForGame({
  awayAbbr,
  homeAbbr,
  awayProbablePitcher,
  homeProbablePitcher,
}) {
  logger.info("[MLB PITCHERS]", {
    away: formatPitcherLogLine(awayAbbr, awayProbablePitcher),
    home: formatPitcherLogLine(homeAbbr, homeProbablePitcher),
  });
}
