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
  const s = g.startTimeUTC;
  if (!s) return null;

  if (typeof s === "string") {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (s?.toDate) return s.toDate();

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
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

  const seasonId = await getSeasonIdForGameYmd(gameYmd);
  const firstGameUTC = await getFirstGameUtcForGameYmd(gameYmd);

  if (!firstGameUTC) {
    logger.warn("[asc] No firstGameUTC found (matchups empty?)", { ascKey, groupId, gameYmd, type });
    return { ok: false, reason: "NO_MATCHUPS" };
  }

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
        stepType: Number(type),     // 1..4 (ou 1..7 si ASC7)
        description: description || null,
      },

      // ✅ IMPORTANT:
      // On NE met PAS poolStatus/poolCount ici.
      // Le trigger functions/defis/onDefiCreated.js doit générer playerPool.
      //
      // Optionnel (safe): garder seasonId/poolGameDate pour aider debug,
      // mais onDefiCreated les écrasera.
      poolSeasonId: seasonId || null,
      poolGameDate: String(gameYmd),
    });
  });

  logger.info("[asc] Defi created (if missing)", { ascKey, groupId, gameYmd, type, defiId, defiKey });
  return { ok: true, defiId, defiKey };
}