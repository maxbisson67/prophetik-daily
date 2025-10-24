// functions/nhlIngest.js
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
function buildUrl({ seasonId, start = 0, limit = PAGE_SIZE, reportType = "season" }) {
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
    const playerId = String(r.playerId ?? "");
    const fullName = r.playerName ?? "";
    const teamAbbr = r.teamAbbrev ?? "";
    const goals = Number(r.goals ?? 0);
    const assists = Number(r.assists ?? 0);
    const points = Number(r.points ?? goals + assists);
    return { playerId, fullName, teamAbbr, goals, assists, points };
  });

  // dédup par playerId
  return Object.values(
    rows.reduce((acc, x) => {
      if (!x.playerId) return acc;
      acc[x.playerId] = x;
      return acc;
    }, {})
  );
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
  { schedule: "0 8 * * *", timeZone: "America/Toronto", region: "us-central1" },
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
        // just log
        logger.info("would migrate", { from: docSnap.id, to: compositeId });
        continue;
      }

      batch.set(
        newRef,
        {
          ...data,
          seasonId, // assure cohérence
          updatedAt: FieldValue.serverTimestamp(),
          migratedFromId: docSnap.id,
        },
        { merge: true }
      );
      ops++;
      migrated++;

      // (Optionnel) supprimer l’ancien doc — je recommande de le faire après vérification
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