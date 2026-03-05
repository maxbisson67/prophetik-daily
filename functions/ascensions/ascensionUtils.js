// functions/ascensions/ascensionUtils.js
import { db, FieldValue, logger } from "../utils.js";
import { APP_TZ, toYmdInTz, addDaysToYmd } from "../ProphetikDate.js";

function ymdCompact(ymd) {
  return String(ymd || "").replaceAll("-", "");
}

function dowInTz(date = new Date(), tz = APP_TZ) {
  // 0=Sun .. 6=Sat
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

export function todayAppYmd() {
  return toYmdInTz(new Date(), APP_TZ);
}

export function appYmdFromDate(date) {
  return toYmdInTz(date, APP_TZ);
}

export function getAsc4TypeForYmd(gameYmd) {
  // Ascension 4: Wed(3)=1x1, Thu(4)=2x2, Fri(5)=3x3, Sat(6)=4x4
  const noonLocal = new Date(`${gameYmd}T12:00:00`);
  const dow = dowInTz(noonLocal, APP_TZ);

  if (dow === 3) return 1;
  if (dow === 4) return 2;
  if (dow === 5) return 3;
  if (dow === 6) return 4;
  return null;
}

export function computeAsc4GameYmdForNow({ startStrategy = "immediate" } = {}) {
  const now = new Date();
  const todayYmd = toYmdInTz(now, APP_TZ);

  const todayType = getAsc4TypeForYmd(todayYmd);
  if (startStrategy === "immediate" && todayType) {
    return { gameYmd: todayYmd, type: todayType };
  }

  const dow = dowInTz(now, APP_TZ);
  const delta = (3 - dow + 7) % 7 || 7;
  const nextWed = addDaysToYmd(todayYmd, delta);
  return { gameYmd: nextWed, type: 1 };
}

/* ------------------------------------------------------------------ */
/*  Season config helpers (Option A)                                   */
/* ------------------------------------------------------------------ */

async function getCurrentSeasonConfig() {
  const snap = await db.doc("app_config/currentSeason").get();
  const c = snap.exists ? snap.data() || {} : {};
  if (String(c?.sport || "").toLowerCase() !== "nhl") return null;
  if (c?.active === false) return null;
  return c;
}

// Returns: "preseason" | "regular" | "playoffs" | "offseason" | "unknown"
async function getNhlPhaseForGameYmd(gameYmd) {
  const c = await getCurrentSeasonConfig();
  if (!c) return "unknown";

  const rsStart = String(c.regularSeasonStartYmd || c.regularSeasonStartDate || c.fromYmd || "");
  const rsEnd = String(c.regularSeasonEndYmd || c.regularSeasonEndDate || "");
  const poEnd = String(c.playoffEndYmd || c.playoffEndDate || c.toYmd || "");

  // si on n'a pas assez d'info, on évite de bloquer trop agressivement
  if (!rsStart || !poEnd) return "unknown";

  if (String(gameYmd) < rsStart) return "preseason";

  // playoffs end = borne finale
  if (String(gameYmd) > poEnd) return "offseason";

  // si on a rsEnd, on peut distinguer regular vs playoffs
  if (rsEnd && String(gameYmd) > rsEnd) return "playoffs";

  return "regular";
}

// On maintient une whitelist simple des abbr NHL.
// (Inclut UTA pour Utah, et l’ensemble "standard" moderne.)
const NHL_ABBR = new Set([
  "ANA","ARI","BOS","BUF","CGY","CAR","CHI","COL","CBJ","DAL","DET","EDM",
  "FLA","LAK","MIN","MTL","NJD","NSH","NYI","NYR","OTT","PHI","PIT","SEA",
  "SJS","STL","TBL","TOR","VAN","VGK","WSH","WPG","UTA",
]);

function isNhlAbbr(abbr) {
  const a = String(abbr || "").toUpperCase();
  return NHL_ABBR.has(a);
}

function parseStartTimeUTCToDate(s) {
  if (!s) return null;
  if (typeof s === "string") {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (s?.toDate) return s.toDate();
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function getSeasonIdForGameYmd(gameYmd) {
  const snap = await db.doc("app_config/currentSeason").get();
  const c = snap.exists ? snap.data() || {} : {};

  if (!c?.active) return null;
  if (String(c?.sport || "").toLowerCase() !== "nhl") return null;

  const from = String(c.fromYmd || "");
  const to = String(c.toYmd || "");
  if (!from || !to) return c.seasonId || null;

  if (from <= gameYmd && gameYmd <= to) return c.seasonId || null;
  return null;
}

/**
 * ✅ NOUVEAU: retourne le premier match "éligible Prophetik":
 * - phase = regular ou playoffs (pas preseason/offseason)
 * - équipes = NHL (abbr whitelist)
 *
 * Returns:
 *  { ok:true, firstGameUTC:Date }
 *  { ok:false, reason:"PRESEASON"|"OFFSEASON"|"NO_MATCHUPS"|"NO_ELIGIBLE_GAMES"|"UNKNOWN_SEASON" }
 */
export async function getFirstEligibleGameUtcForGameYmd(gameYmd) {
  const phase = await getNhlPhaseForGameYmd(gameYmd);

  if (phase === "preseason") return { ok: false, reason: "PRESEASON" };
  if (phase === "offseason") return { ok: false, reason: "OFFSEASON" };
  // "unknown" => on ne bloque pas tout de suite, on continue (fallback)
  // mais si tu préfères être strict: return {ok:false,reason:"UNKNOWN_SEASON"}

  const yyyymmdd = ymdCompact(gameYmd);

  // On lit un petit lot, puis on filtre (évite une query composite)
  const snap = await db
    .collection("nhl_matchups_daily")
    .doc(yyyymmdd)
    .collection("games")
    .orderBy("startTimeUTC", "asc")
    .limit(25)
    .get();

  if (snap.empty) return { ok: false, reason: "NO_MATCHUPS" };

  for (const doc of snap.docs) {
    const g = doc.data() || {};
    const homeAbbr = g?.home?.abbr || g?.home?.teamAbbr || null;
    const awayAbbr = g?.away?.abbr || g?.away?.teamAbbr || null;

    // filtre hors-NHL (Olympiques etc.)
    if (!isNhlAbbr(homeAbbr) || !isNhlAbbr(awayAbbr)) continue;

    const dt = parseStartTimeUTCToDate(g?.startTimeUTC);
    if (dt) return { ok: true, firstGameUTC: dt };
  }

  return { ok: false, reason: "NO_ELIGIBLE_GAMES" };
}

/**
 * ✅ On garde l'ancienne signature pour compat.
 * (Mais attention: elle peut retourner un match hors NHL si tu l’utilises ailleurs.)
 */
export async function getFirstGameUtcForGameYmd(gameYmd) {
  const yyyymmdd = ymdCompact(gameYmd);
  const snap = await db
    .collection("nhl_matchups_daily")
    .doc(yyyymmdd)
    .collection("games")
    .orderBy("startTimeUTC", "asc")
    .limit(1)
    .get();

  if (snap.empty) return null;

  const g = snap.docs[0].data() || {};
  return parseStartTimeUTCToDate(g?.startTimeUTC);
}

export function signupDeadlineFromFirstGame(firstGameUtc, minutesBefore = 60) {
  if (!firstGameUtc) return null;
  const ms = firstGameUtc.getTime() - minutesBefore * 60 * 1000;
  return new Date(ms);
}

export function buildDefiKey(gameYmd, type) {
  return `${gameYmd}_${type}x${type}`;
}

export function buildAscDefiDocId({ ascKey, groupId, gameYmd, type }) {
  return `${gameYmd}_${String(ascKey).toLowerCase()}_${groupId}_${type}`;
}

export async function createAscensionDefiIfMissing({
  ascKey,
  groupId,
  createdBy,
  gameYmd,
  type,
  title,
  description,
}) {
  const defiKey = buildDefiKey(gameYmd, type);
  const defiId = buildAscDefiDocId({ ascKey, groupId, gameYmd, type });

  // ✅ saison valide (selon fromYmd/toYmd)
  const seasonId = await getSeasonIdForGameYmd(gameYmd);
  if (!seasonId) {
    logger.warn("[asc] Out of season (seasonId null)", { ascKey, groupId, gameYmd, type });
    return { ok: false, reason: "OUT_OF_SEASON" };
  }

  // ✅ premier match éligible (NHL + pas pré-saison)
  const fg = await getFirstEligibleGameUtcForGameYmd(gameYmd);
  if (!fg.ok) {
    logger.warn("[asc] No eligible firstGameUTC", { ascKey, groupId, gameYmd, type, reason: fg.reason });
    // map vers raisons "simples"
    if (fg.reason === "NO_MATCHUPS") return { ok: false, reason: "NO_MATCHUPS" };
    if (fg.reason === "NO_ELIGIBLE_GAMES") return { ok: false, reason: "NO_ELIGIBLE_GAMES" };
    if (fg.reason === "PRESEASON") return { ok: false, reason: "PRESEASON" };
    if (fg.reason === "OFFSEASON") return { ok: false, reason: "OFFSEASON" };
    return { ok: false, reason: fg.reason || "UNKNOWN" };
  }

  const firstGameUTC = fg.firstGameUTC;

  const signupDeadline = signupDeadlineFromFirstGame(firstGameUTC, 60);
  const ref = db.doc(`defis/${defiId}`);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return;

    tx.set(ref, {
      // identifiants
      createdBy: createdBy || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),

      groupId: String(groupId),
      status: "open",

      // Défi
      title: title || `Challenge ${type}x${type}`,
      type: Number(type),
      gameDate: String(gameYmd),
      defiKey,

      // Timing
      firstGameUTC,      // Date => Timestamp Firestore
      signupDeadline,    // Date => Timestamp Firestore

      // économie
      participationCost: Number(type),
      pot: 0,
      participantsCount: 0,

      // marqueur Ascension
      ascension: {
        key: String(ascKey),        // "ASC4" | "ASC7"
        stepType: Number(type),
        description: description || null,
      },

      poolSeasonId: seasonId,
      poolGameDate: String(gameYmd),
    });
  });

  logger.info("[asc] Defi created (if missing)", { ascKey, groupId, gameYmd, type, defiId, defiKey });
  return { ok: true, defiId, defiKey };
}