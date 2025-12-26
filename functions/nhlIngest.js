// functions/nhlIngest.js
// Ingère les statistiques cumullé de l'année en cours et de l'année précédente
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

const NHL_BASE = "https://api.nhle.com/stats/rest/en/skater/summary";
const PAGE_SIZE = 100;

/** 🔢 Déduit automatiquement la saison en format 20242025
 *  Règle: à partir de juillet => saison (YYYY)(YYYY+1), avant juillet => (YYYY-1)(YYYY)
 */
function getCurrentSeasonId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // jan=1
  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}${endYear}`;
}

/** 🧰 Construit l’URL pour une page donnée */
function buildUrl({
  seasonId,
  start = 0,
  limit = PAGE_SIZE,
  reportType = "season",
}) {
  const url = new URL(NHL_BASE);
  url.searchParams.set("isAggregate", "false");
  url.searchParams.set("isGame", "false");
  url.searchParams.set("reportType", reportType); // "season" d’abord; fallback "basic"
  url.searchParams.set("start", String(start));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "points");
  // RS régulière = gameTypeId=2
  url.searchParams.set("cayenneExp", `seasonId=${seasonId} and gameTypeId=2`);
  logger.log("URL:" + url);
  return url;
}

/** 📦 Télécharge une page NHL, avec fallback de reportType */
async function fetchSkatersPage(seasonId, start = 0) {
  // 1) tentative reportType=season
  let url = buildUrl({ seasonId, start, reportType: "season" });
  let res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("NHL page fetch failed (season). Retrying with basic.", {
      http: res.status,
      url: url.toString(),
      bodySnippet: body?.slice(0, 200),
    });
    // 2) fallback reportType=basic
    url = buildUrl({ seasonId, start, reportType: "basic" });
    res = await fetch(url.toString());
    if (!res.ok) {
      const body2 = await res.text().catch(() => "");
      logger.error("NHL page fetch failed (basic) as well.", {
        http: res.status,
        url: url.toString(),
        bodySnippet: body2?.slice(0, 200),
      });
      throw new Error(`NHL HTTP ${res.status}`);
    }
  }
  return res.json(); // { data, total, ... }
}

const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const toStr = (v, def = "") => (v === null || v === undefined ? def : String(v));
const firstDefined = (...vals) => {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
};

/* ===================== COEFFICIENT (v2) ===================== */

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
function norm(x, min, max) {
  const v = (Number(x || 0) - min) / (max - min);
  return clamp(v, 0, 1);
}

function isDefense(positionCodeRaw) {
  const pos = String(positionCodeRaw || "").trim().toUpperCase();
  return pos === "D" || pos === "LD" || pos === "RD";
}

/**
 * Coeff "douceur" mais avec D vs F :
 * - Talent (0..1): PPG (80%) + Shooting% (20%)
 * - Fiabilité (0..1): gamesPlayed + shots
 * - On applique des PLAGES différentes selon D ou F pour rapprocher les D.
 *
 * IMPORTANT: coefficient multiplie les points bruts.
 * - F: léger nerf/boost (plage étroite)
 * - D: boost plus possible (plage plus large)
 */
function computeCoeffV2_DF(r) {
  const pointsPerGame = toNum(r.pointsPerGame, 0);
  const shootingPct = toNum(r.shootingPct, 0);
  const gamesPlayed = toNum(r.gamesPlayed, 0);
  const shots = toNum(r.shots, 0);

  const defense = isDefense(r.positionCode);

  // Plages “raisonnables” (à ajuster au besoin)
  const ppgN = norm(pointsPerGame, 0.20, 1.60);
  const shN = norm(shootingPct, 0.05, 0.22);

  // Talent: on met l’accent sur la production
  const talent = 0.8 * ppgN + 0.2 * shN; // 0..1

  // Fiabilité: on veut éviter de sur-ajuster sur 5 matchs / 6 tirs
  const relGP = clamp(gamesPlayed / 40, 0, 1);
  const relS = clamp(shots / 120, 0, 1);
  const reliability = 0.6 * relGP + 0.4 * relS; // 0..1

  // Amplitude: D a une amplitude plus forte que F
  const AMP = defense ? 0.16 : 0.10;

  // raw: talent haut => coeff un peu plus bas (nerf des "obvious picks")
  // talent bas => coeff un peu plus haut (aide les choix moins dominants)
  const raw = 1 + AMP * (0.5 - talent) * 2; // talent=1 => 1-AMP ; talent=0 => 1+AMP

  // Ramener vers 1.0 si pas fiable
  let coeff = 1 + (raw - 1) * reliability;

  // Boost structurel pour D (pour combler le gap topF vs topD)
  if (defense) coeff += 0.05;

  // Clamps par groupe (D vs F)
  // F: petit range
  // D: range plus permissif + jamais trop bas
  const min = defense ? 1.00 : 0.92;
  const max = defense ? 1.18 : 1.06;

  coeff = clamp(coeff, min, max);

  return {
    coeff: Number(coeff.toFixed(4)),
    coeff_v: "v2_df",
    coeff_meta: {
      defense,
      ppgN: Number(ppgN.toFixed(4)),
      shN: Number(shN.toFixed(4)),
      talent: Number(talent.toFixed(4)),
      reliability: Number(reliability.toFixed(4)),
      raw: Number(raw.toFixed(4)),
      min,
      max,
    },
  };
}

/** 📊 Récupère tous les skaters d'une saison */
async function fetchAllSkatersForSeason(seasonId) {
  const all = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const page = await fetchSkatersPage(seasonId, start);
    const arr = page?.data || [];
    logger.info("NHL page", { seasonId, start, count: arr.length });

    if (!arr.length) break;
    all.push(...arr);

    // Si l’API renvoie moins que PAGE_SIZE, on a atteint la fin
    if (arr.length < PAGE_SIZE) break;
  }

  const rows = all.map((r) => {
    // ⚠️ noms de champs possibles selon la réponse NHL
    const playerId = toStr(firstDefined(r.playerId, r.playerID, r.id), "");
    const skaterFullName = toStr(
      firstDefined(r.skaterFullName, r.playerName, r.fullName, r.name),
      ""
    );
    const lastName = toStr(firstDefined(r.lastName, r.playerLastName), "");
    const teamAbbrevs = toStr(
      firstDefined(r.teamAbbrevs, r.teamAbbrev, r.team, r.teamCode),
      ""
    );

    const goals = toNum(r.goals);
    const assists = toNum(r.assists);
    const points = toNum(firstDefined(r.points, goals + assists), goals + assists);

    // Champs “riches”
    const gamesPlayed = toNum(firstDefined(r.gamesPlayed, r.games), 0);
    const pointsPerGame = toNum(firstDefined(r.pointsPerGame, r.ppg), 0);
    const shootingPct = toNum(
      firstDefined(r.shootingPct, r.shootingPercentage, r.shootingPctg),
      0
    );
    const shots = toNum(firstDefined(r.shots, r.shotAttempts, r.sog), 0);

    const evGoals = toNum(firstDefined(r.evGoals, r.evenStrengthGoals), 0);
    const evPoints = toNum(firstDefined(r.evPoints, r.evenStrengthPoints), 0);

    const ppGoals = toNum(firstDefined(r.ppGoals, r.powerPlayGoals), 0);
    const ppPoints = toNum(firstDefined(r.ppPoints, r.powerPlayPoints), 0);

    const shGoals = toNum(firstDefined(r.shGoals, r.shortHandedGoals), 0);
    const shPoints = toNum(firstDefined(r.shPoints, r.shortHandedPoints), 0);

    const otGoals = toNum(firstDefined(r.otGoals, r.overtimeGoals), 0);
    const gameWinningGoals = toNum(firstDefined(r.gameWinningGoals, r.gwg), 0);

    const penaltyMinutes = toNum(firstDefined(r.penaltyMinutes, r.pim), 0);
    const plusMinus = toNum(firstDefined(r.plusMinus, r.plusminus), 0);

    const faceoffWinPct = toNum(
      firstDefined(r.faceoffWinPct, r.faceOffWinPct, r.foWinPct),
      0
    );

    const positionCode = toStr(firstDefined(r.positionCode, r.position), "");
    const shootsCatches = toStr(firstDefined(r.shootsCatches, r.shoots), "");

    // Selon l’API, ça peut être en secondes ou en "MM:SS" — on stocke tel quel si non numérique
    const toiRaw = firstDefined(r.timeOnIcePerGame, r.toiPerGame, r.timeOnIce);
    const timeOnIcePerGame = typeof toiRaw === "string" ? toiRaw : toNum(toiRaw, 0);

    const baseDoc = {
      // clés principales
      playerId,
      seasonId,

      // identités
      skaterFullName,
      lastName,
      teamAbbrevs,

      // scoring basique
      goals,
      assists,
      points,

      // métriques pour ton coefficient
      gamesPlayed,
      pointsPerGame,
      shootingPct,
      shots,

      // split / contexte
      evGoals,
      evPoints,
      ppGoals,
      ppPoints,
      shGoals,
      shPoints,
      otGoals,
      gameWinningGoals,

      // autres
      penaltyMinutes,
      plusMinus,
      faceoffWinPct,
      positionCode,
      shootsCatches,
      timeOnIcePerGame,
    };

    // ✅ coeff ici
    const coeffData = computeCoeffV2_DF(baseDoc);

    return {
      ...baseDoc,
      ...coeffData,
    };
  });

  // dédup par playerId (garde la dernière occurrence)
  const dedup = Object.values(
    rows.reduce((acc, x) => {
      if (!x.playerId) return acc;
      acc[x.playerId] = x;
      return acc;
    }, {})
  );

  // option: filtrer les lignes “vides”
  return dedup.filter((r) => r.playerId && r.skaterFullName);
}

/** 🔥 Écrit dans Firestore avec clé composite `${seasonId}_${playerId}` */
async function upsertStatsToFirestore(rows, seasonId) {
  let written = 0;
  let batch = db.batch();
  let ops = 0;

  for (const r of rows) {
    if (!r.playerId) continue;

    // ✅ clé composite par saison
    const docId = `${seasonId}_${String(r.playerId)}`;
    const ref = db.collection("nhl_player_stats_current").doc(docId);

    batch.set(
      ref,
      {
        ...r,
        seasonId,
        updatedAt: FieldValue.serverTimestamp(),
        source: "nhl-api/rest skater/summary",
      },
      { merge: true }
    );

    ops++;
    written++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return written;
}

/** 🏒 Ingestion complète pour une saison donnée */
async function ingestSeason(seasonId) {
  const t0 = Date.now();
  logger.info("NHL ingest start", { seasonId });
  const rows = await fetchAllSkatersForSeason(seasonId);
  logger.info("NHL ingest fetched", { seasonId, count: rows.length });
  const written = await upsertStatsToFirestore(rows, seasonId);
  logger.info("NHL ingest done", { seasonId, written, ms: Date.now() - t0 });
  return { seasonId, written };
}

/* ===================== EXPORTED FUNCTIONS ===================== */

/** ☑️ Callable manuelle */
export const ingestSkaterStatsForSeason = onCall(
  { region: "us-central1", timeoutSeconds: 540 },
  async (req) => {
    // Tu peux passer { seasonId } ou laisser auto-détection
    const seasonId = String(req.data?.seasonId || getCurrentSeasonId());
    return ingestSeason(seasonId);
  }
);

/** 🕗 Cron quotidienne 8h (America/Toronto) sur la saison courante détectée */
export const cronIngestSkaterStatsDaily = onSchedule(
  { schedule: "every 5 minutes", timeZone: "America/Toronto", region: "us-central1" },
  // every 5 minutes
  //  0 8 * * * 
  async () => {
    const seasonId = getCurrentSeasonId();
    logger.info("cronIngestSkaterStatsDaily running", { seasonId });
    return ingestSeason(seasonId);
  }
);

/** 🛠 Migration: duplique les docs legacy (id=playerId) vers les ids composites `${seasonId}_${playerId}`.
 *  Appel: httpsCallable('migrateStatIdsToComposite')({ seasonId: '20242025', dryRun: true })
 */
export const migrateStatIdsToComposite = onCall(
  { region: "us-central1", timeoutSeconds: 540 },
  async (req) => {
    const seasonId = String(req.data?.seasonId || "");
    const dryRun = req.data?.dryRun !== false; // par défaut: dry-run
    if (!seasonId) throw new Error("seasonId requis");

    logger.info("migrateStatIdsToComposite start", { seasonId, dryRun });

    const snap = await db
      .collection("nhl_player_stats_current")
      .where("seasonId", "==", seasonId)
      .get();

    if (snap.empty) {
      logger.info("migrateStatIdsToComposite: no docs");
      return { seasonId, scanned: 0, migrated: 0, dryRun };
    }

    let migrated = 0;
    let scanned = 0;

    let batch = db.batch();
    let ops = 0;

    for (const docSnap of snap.docs) {
      scanned++;
      const data = docSnap.data() || {};
      const playerId = String(data.playerId || "");
      if (!playerId) continue;

      const compositeId = `${seasonId}_${playerId}`;
      const newRef = db.collection("nhl_player_stats_current").doc(compositeId);

      if (dryRun) {
        logger.info("would migrate", { from: docSnap.id, to: compositeId });
        continue;
      }

      batch.set(
        newRef,
        {
          ...data,
          seasonId,
          updatedAt: FieldValue.serverTimestamp(),
          migratedFromId: docSnap.id,
        },
        { merge: true }
      );
      ops++;
      migrated++;

      // Optionnel: supprimer l’ancien doc après validation
      // batch.delete(docSnap.ref); ops++;

      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (!dryRun && ops > 0) await batch.commit();

    logger.info("migrateStatIdsToComposite done", { seasonId, scanned, migrated, dryRun });
    return { seasonId, scanned, migrated, dryRun };
  }
);