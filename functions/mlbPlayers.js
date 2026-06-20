import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "./utils.js";

const BATCH_MAX = 450;
const MLB_BASE = "https://statsapi.mlb.com/api/v1";

function asString(v, def = "") {
  if (v === null || v === undefined) return def;
  return String(v);
}

function asNum(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function safeUpper(v) {
  return asString(v, "").trim().toUpperCase();
}

function pickHeadshotUrl(playerId) {
  const id = asString(playerId, "").trim();
  if (!id) return null;

  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/${id}/headshot/67/current`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Prophetik/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${url}`);
  }

  return res.json();
}

async function fetchMlbTeams() {
  const url = `${MLB_BASE}/teams?sportId=1&activeStatus=Y`;
  const json = await fetchJson(url);

  return (json?.teams || [])
    .map((t) => ({
      teamId: asNum(t?.id),
      teamName: asString(t?.name),
      teamAbbr: safeUpper(t?.abbreviation),
    }))
    .filter((t) => t.teamId && t.teamAbbr);
}

async function fetchMlbRoster(team) {
  const url = `${MLB_BASE}/teams/${team.teamId}/roster?rosterType=active`;
  const json = await fetchJson(url);
  return Array.isArray(json?.roster) ? json.roster : [];
}

function normalizeMlbPlayer(team, row) {
  const person = row?.person || {};
  const position = row?.position || {};

  const playerId = person?.id;
  if (!playerId) return null;

  const fullName = asString(person?.fullName).trim();
  if (!fullName) return null;

  const positionCode = safeUpper(position?.abbreviation);

  if (positionCode === "P") {
    return null;
  }

  return {
    playerId: asString(playerId),
    id: asString(playerId),

    firstName: null,
    lastName: null,
    fullName,

    teamId: team.teamId,
    teamAbbr: team.teamAbbr,
    teamName: team.teamName,

    positionCode: positionCode || null,
    positionName: asString(position?.name) || null,
    positionType: asString(position?.type) || null,

    headshotUrl: pickHeadshotUrl(playerId),
    headshot: pickHeadshotUrl(playerId),

    active: true,
    league: "MLB",
    source: "statsapi.mlb.com roster",
  };
}

async function commitInChunks(writes) {
  let batch = db.batch();
  let ops = 0;
  let committed = 0;

  for (const w of writes) {
    batch.set(w.ref, w.data, { merge: true });
    ops++;

    if (ops >= BATCH_MAX) {
      await batch.commit();
      committed += ops;
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
    committed += ops;
  }

  return committed;
}

async function deactivateMissingMlbPlayers({ seenIdsSet, nowTs }) {
  const snap = await db.collection("mlb_players").where("active", "==", true).get();

  if (snap.empty) return { scanned: 0, deactivated: 0 };

  let batch = db.batch();
  let ops = 0;
  let scanned = 0;
  let deactivated = 0;

  for (const doc of snap.docs) {
    scanned++;

    if (seenIdsSet.has(doc.id)) continue;

    batch.set(
      doc.ref,
      {
        active: false,
        deactivatedAt: nowTs,
        updatedAt: nowTs,
        deactivatedReason: "not_in_active_rosters",
      },
      { merge: true }
    );

    ops++;
    deactivated++;

    if (ops >= BATCH_MAX) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops) await batch.commit();

  return { scanned, deactivated };
}

async function runRefreshMlbPlayers() {
  const startedAt = Date.now();
  const nowTs = FieldValue.serverTimestamp();

  logger.info("[refreshMlbPlayers] start");

  const teams = await fetchMlbTeams();

  logger.info("[refreshMlbPlayers] teams loaded", {
    teams: teams.length,
  });

  const playersById = new Map();

  for (const team of teams) {
    try {
      const roster = await fetchMlbRoster(team);

      const rows = roster
        .map((r) => normalizeMlbPlayer(team, r))
        .filter(Boolean);

      logger.info("[refreshMlbPlayers] roster ok", {
        team: team.teamAbbr,
        count: rows.length,
      });

      for (const p of rows) {
        playersById.set(p.playerId, p);
      }
    } catch (e) {
      logger.warn("[refreshMlbPlayers] roster failed", {
        team: team.teamAbbr,
        err: asString(e?.message || e),
      });
    }
  }

  const players = Array.from(playersById.values());

  const writes = players.map((p) => ({
    ref: db.collection("mlb_players").doc(p.playerId),
    data: {
      ...p,
      active: true,
      lastSeenAt: nowTs,
      updatedAt: nowTs,
    },
  }));

  const written = await commitInChunks(writes);

  const seenIds = new Set(players.map((p) => String(p.playerId)));
  const deact = await deactivateMissingMlbPlayers({ seenIdsSet: seenIds, nowTs });

  await db.collection("_jobs").doc("refreshMlbPlayers").set(
    {
      ok: true,
      countTeams: teams.length,
      countPlayers: players.length,
      written,
      deactivated: deact.deactivated,
      ranAt: nowTs,
      ms: Date.now() - startedAt,
      source: "mlbPlayers.js",
    },
    { merge: true }
  );

  logger.info("[refreshMlbPlayers] done", {
    players: players.length,
    written,
    deactivated: deact.deactivated,
    ms: Date.now() - startedAt,
  });

  return {
    ok: true,
    countTeams: teams.length,
    countPlayers: players.length,
    written,
    deactivated: deact.deactivated,
  };
}

export const refreshMlbPlayers = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
  },
  async () => runRefreshMlbPlayers()
);

export const refreshMlbPlayersCron = onSchedule(
  {
    schedule: "15 5 * * *",
    //schedule: "*/2 * * * *", // pour test
    timeZone: "America/Toronto",
    region: "us-central1",
    timeoutSeconds: 540,
  },
  async () => {
    await runRefreshMlbPlayers();
  }
);