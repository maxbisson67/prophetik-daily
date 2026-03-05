// functions/players.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, logger, apiWebRoster } from "./utils.js";

// Firestore batch limit = 500
const BATCH_MAX = 450; // marge

function asString(v, def = "") {
  if (v === null || v === undefined) return def;
  return String(v);
}

function asNum(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function pickNamePart(v) {
  // api-web renvoie parfois { default: "..." }
  if (typeof v === "string") return v;
  if (v && typeof v.default === "string") return v.default;
  return "";
}

function normalizePos(p) {
  const raw = p?.positionCode ?? p?.position?.abbreviation ?? p?.position;
  return asString(raw, "").trim().toUpperCase();
}

function pickHeadshotUrl(p) {
  // dans ton payload roster: p.headshot est déjà une URL
  const url =
    p?.headshot ||
    p?.headshotUrl ||
    p?.mugshot ||
    p?.imageUrl ||
    null;

  const s = url ? String(url).trim() : "";
  return s ? s : null;
}

function normalizeBirthPlacePart(v) {
  // peut être string ou { default: "...", fr:"..." }
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v?.default) return v.default;
  return null;
}

function normalizePlayer(teamAbbr, p) {
  const playerId = p?.playerId ?? p?.id ?? p?.playerID;
  if (!playerId) return null;

  const positionCode = normalizePos(p);
  if (!positionCode) return null;

  // Exclure gardiens (tu ne veux que skaters)
  if (positionCode === "G") return null;

  const firstName = pickNamePart(p?.firstName);
  const lastName = pickNamePart(p?.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const headshotUrl = pickHeadshotUrl(p);

  return {
    // ids
    playerId: asString(playerId),
    id: asString(playerId), // compat legacy si tu l’utilises déjà

    // identity
    firstName: firstName || null,
    lastName: lastName || null,
    fullName: fullName || null,

    // team/pos
    teamAbbr: asString(teamAbbr).toUpperCase(),
    positionCode,

    // extras utiles UI
    headshotUrl,              // ✅ ce que tu veux pour l’avatar
    headshot: headshotUrl,    // ✅ alias (optionnel) si tu as déjà du code qui lit "headshot"
    sweaterNumber: asNum(p?.sweaterNumber, null),
    shootsCatches: asString(p?.shootsCatches, "") || null,

    heightInInches: asNum(p?.heightInInches, null),
    weightInPounds: asNum(p?.weightInPounds, null),
    heightInCentimeters: asNum(p?.heightInCentimeters, null),
    weightInKilograms: asNum(p?.weightInKilograms, null),

    birthDate: asString(p?.birthDate, "") || null,
    birthCity: normalizeBirthPlacePart(p?.birthCity),
    birthCountry: asString(p?.birthCountry, "") || null,
    birthStateProvince: normalizeBirthPlacePart(p?.birthStateProvince),

    // state
    active: true,
    source: "api-web.nhle.com roster",
  };
}

function extractRosterPlayers(teamAbbr, roster) {
  const buckets = [
    ...(roster?.forwards || []),
    ...(roster?.defensemen || []),
    ...(roster?.goalies || []), // filtrés par normalizePlayer (G excluded)
    ...(Array.isArray(roster?.skaters) ? roster.skaters : []),
    ...(Array.isArray(roster?.roster) ? roster.roster : []), // parfois un format alternatif
  ];

  const out = [];
  for (const p of buckets) {
    const row = normalizePlayer(teamAbbr, p);
    if (row) out.push(row);
  }
  return out;
}

async function commitInChunks(writes) {
  // writes = [{ ref, data }]
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

// (Optionnel) désactiver les joueurs qui ne sont plus “vus” dans aucun roster
async function deactivateMissingPlayers({ seenIdsSet, nowTs }) {
  // ⚠️ si ta collection est grosse, tu peux le faire en job séparée ou paginée
  const snap = await db.collection("nhl_players").where("active", "==", true).get();
  if (snap.empty) return { scanned: 0, deactivated: 0 };

  let scanned = 0;
  let deactivated = 0;

  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    scanned++;
    const id = doc.id;
    if (seenIdsSet.has(id)) continue;

    batch.set(
      doc.ref,
      {
        active: false,
        deactivatedAt: nowTs,
        updatedAt: nowTs,
        deactivatedReason: "not_in_rosters",
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

async function runRefreshNhlPlayers() {
  // ⚠️ Idéalement: rendre cette liste dynamique plus tard.
  const teams = [
    { abbr: "MTL" }, { abbr: "TOR" }, { abbr: "OTT" }, { abbr: "BOS" }, { abbr: "NYR" }, { abbr: "NJD" },
    { abbr: "BUF" }, { abbr: "TBL" }, { abbr: "FLA" }, { abbr: "DET" }, { abbr: "CHI" }, { abbr: "COL" },
    { abbr: "DAL" }, { abbr: "EDM" }, { abbr: "CGY" }, { abbr: "VAN" }, { abbr: "SEA" }, { abbr: "LAK" },
    { abbr: "ANA" }, { abbr: "UTA" }, { abbr: "WPG" }, { abbr: "MIN" }, { abbr: "NSH" }, { abbr: "STL" },
    { abbr: "VGK" }, { abbr: "SJS" }, { abbr: "CBJ" }, { abbr: "PIT" }, { abbr: "PHI" }, { abbr: "WSH" },
    { abbr: "CAR" },{ abbr: "NYI" }
  ];

  const startedAt = Date.now();
  logger.info("[refreshNhlPlayers] start", { teams: teams.length });

  // 1) Fetch rosters (séquentiel = plus safe pour éviter rate-limit; on optimisera si besoin)
  const playersById = new Map(); // playerId -> data

  for (const team of teams) {
    const teamAbbr = asString(team?.abbr).toUpperCase();
    if (!teamAbbr) continue;

    let roster;
    try {
      roster = await apiWebRoster(team);
    } catch (e) {
      logger.warn("[refreshNhlPlayers] roster fetch failed", {
        team: teamAbbr,
        err: asString(e?.message || e),
      });
      continue;
    }

    const rows = extractRosterPlayers(teamAbbr, roster);
    logger.info("[refreshNhlPlayers] roster ok", { team: teamAbbr, count: rows.length });

    for (const r of rows) {
      // dédup: si un joueur apparaît 2 fois (rare), la dernière gagne
      playersById.set(r.playerId, r);
    }
  }

  const players = Array.from(playersById.values());
  logger.info("[refreshNhlPlayers] total unique players", { count: players.length });

  // 2) Préparer écritures (batch)
  const nowTs = FieldValue.serverTimestamp();

  const writes = players.map((p) => {
    const ref = db.collection("nhl_players").doc(p.playerId);
    return {
      ref,
      data: {
        ...p,
        active: true,
        lastSeenAt: nowTs, // ✅ très utile pour debug
        updatedAt: nowTs,
      },
    };
  });

  const written = await commitInChunks(writes);

  // 3) Option: désactiver ceux qui ne sont plus vus (décommenter si tu veux)
  // const seenIds = new Set(players.map((p) => String(p.playerId)));
  // const deact = await deactivateMissingPlayers({ seenIdsSet: seenIds, nowTs });
  // logger.info("[refreshNhlPlayers] deactivateMissingPlayers", deact);

  // 4) Run marker (utile pour debug)
  await db.collection("_jobs").doc("refreshNhlPlayers").set(
    {
      ok: true,
      countPlayers: players.length,
      written,
      // deactivated: deact?.deactivated ?? 0,
      ranAt: nowTs,
      ms: Date.now() - startedAt,
      source: "players.js",
    },
    { merge: true }
  );

  logger.info("[refreshNhlPlayers] done", { written, ms: Date.now() - startedAt });
  return { ok: true, countPlayers: players.length, written };
}

export const refreshNhlPlayers = onCall(
  { region: "us-central1", timeoutSeconds: 540 },
  async () => runRefreshNhlPlayers()
);

export const refreshNhlPlayersCron = onSchedule(
  {
    schedule: "0 5 * * *",
    //schedule: "*/2 * * * *", // pour test
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    await runRefreshNhlPlayers();
  }
);

// alias historique
export const nightlyNhlPlayers = refreshNhlPlayersCron;