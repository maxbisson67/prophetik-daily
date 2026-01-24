// functions/defis/defisCreate.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ✅ Source de vérité date/tz
import { APP_TZ, appYmd, weekAnchorDate } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

/* ----------------------------- helpers ----------------------------- */

function randSuffix(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function formatDefiKey(type) {
  const t = Number(type);
  if (!Number.isFinite(t) || t <= 0) return "unknown";
  return `${t}x${t}`;
}

/** "YYYY-MM-DD" -> "YYYY_MM_DD" */
function ymdToUnderscore(ymd) {
  return String(ymd || "").slice(0, 10).replace(/-/g, "_");
}

// gameDate attendu "YYYY-MM-DD" (string) ou Date/Timestamp -> normalisé "YYYY-MM-DD" selon APP_TZ
function normalizeGameDate(gameDate) {
  if (!gameDate) throw new Error("gameDate requis");

  if (typeof gameDate === "string") {
    if (gameDate.length >= 10) return gameDate.slice(0, 10);
    throw new Error('gameDate string doit être au format "YYYY-MM-DD"');
  }

  const d =
    gameDate?.toDate?.() ? gameDate.toDate()
    : gameDate instanceof Date ? gameDate
    : null;

  if (d) {
    // ✅ Utilise ProphetikDate.appYmd (APP_TZ)
    return appYmd(d); // "YYYY-MM-DD"
  }

  throw new Error('gameDate doit être une string "YYYY-MM-DD" ou un Date/Timestamp');
}

function toDateOrNull(v) {
  if (!v) return null;
  const d = v?.toDate?.() ? v.toDate() : v instanceof Date ? v : new Date(v);
  return Number.isFinite(d?.getTime?.()) ? d : null;
}

/**
 * ISO week key "YYYY-Www", mais calculée sur une date "ancrée"
 * pour que la semaine commence dimanche 08:00 AM (APP_TZ).
 */
function getWeekKeyInTz(now = new Date(), tz = APP_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  // Date UTC “safe” à midi
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  // ISO week algorithm (UTC)
  const dayNum = (utc.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  utc.setUTCDate(utc.getUTCDate() - dayNum + 3); // Thu of this week
  const firstThu = new Date(Date.UTC(utc.getUTCFullYear(), 0, 4, 12, 0, 0));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);

  const week = 1 + Math.round((utc - firstThu) / (7 * 24 * 3600 * 1000));
  const weekYear = utc.getUTCFullYear();
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

async function getUserTier(uid) {
  const a = await db.doc(`entitlements/${uid}`).get();
  if (a.exists) {
    const d = a.data() || {};
    return {
      tier: String(d.tier || "free").toLowerCase(),
      active: d.active !== false,
    };
  }

  const b = await db.doc(`participants/${uid}`).get();
  if (b.exists) {
    const d = b.data() || {};
    return {
      tier: String(d.tier || "free").toLowerCase(),
      active: d.subscriptionActive !== false,
    };
  }

  return { tier: "free", active: true };
}

async function isGroupMemberOrOwner(groupId, uid) {
  if (!groupId || !uid) return false;

  const gm = await db.doc(`group_memberships/${groupId}_${uid}`).get();
  if (gm.exists) {
    const d = gm.data() || {};
    const isActive = d.active !== false;
    const role = String(d.role || "member").toLowerCase();
    if (isActive && (role === "member" || role === "owner")) return true;
  }

  const g = await db.doc(`groups/${String(groupId)}`).get();
  if (g.exists) {
    const gd = g.data() || {};
    if (String(gd.ownerId || gd.createdBy || "") === String(uid)) return true;
  }
  return false;
}

function allowedTypesForTier(tier) {
  const t = String(tier || "free").toLowerCase();

  // ✅ Free: 1x1..4x4 (Ascension 4)
  if (t === "free") return new Set([1, 2, 3, 4]);

  // ✅ Pro: 1x1..7x7
  if (t === "pro") return new Set([1, 2, 3, 4, 5,6,7]);

  // ✅ Vip: 1x1..7x7 (inclut 6x6 et 7x7)
  if (t === "vip") return new Set([1, 2, 3, 4, 5, 6, 7]);

  // fallback safe
  return new Set([1, 2, 3, 4]);
}

function weeklyLimitsForTier(tier) {
  const t = String(tier || "free").toLowerCase();
  if (t === "pro") return { maxCreates: 21, maxJoins: 21 };
  if (t === "vip") return { maxCreates: 250, maxJoins: 250 };
  return { maxCreates: 7, maxJoins: 7 }; // free
}

/* ----------------------------- callable ----------------------------- */
/**
 * Input minimal:
 * { groupId, title, type, gameDate, participationCost?, status?, firstGameUTC?, signupDeadline?, format?, availability?, bonusReward?, isSpecial? }
 */
export const defisCreate = onCall({ region: "us-central1" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth requise.");

  const input = req.data || {};

  // On log au tout début
  logger.info("[defisCreate] start", {
    uid,
    groupId: input.groupId,
    type: input.type,
    gameDate: input.gameDate,
  });

  try {
    const groupId = String(input.groupId || "");
    const title = String(input.title || "");
    const type = Number(input.type);
    const status = String(input.status || "open");
    const participationCost = input.participationCost ?? null;

    if (!groupId) throw new HttpsError("invalid-argument", "groupId requis.");
    if (!title) throw new HttpsError("invalid-argument", "title requis.");
    if (!Number.isFinite(type) || type <= 0) {
      throw new HttpsError("invalid-argument", "type invalide.");
    }
    if (!input.gameDate) throw new HttpsError("invalid-argument", "gameDate requis.");

    // membership/owner
    const okMember = await isGroupMemberOrOwner(groupId, uid);
    if (!okMember) {
      throw new HttpsError(
        "permission-denied",
        "Création refusée: utilisateur non membre/owner actif du groupe."
      );
    }

    // tier
    const ent = await getUserTier(uid);
    const tier = ent.tier || "free";

    // type allowed
    const allowSet = allowedTypesForTier(tier);
    if (allowSet && !allowSet.has(type)) {
      throw new HttpsError("failed-precondition", "PLAN_NOT_ALLOWED", {
        reason: "PLAN_NOT_ALLOWED",
        tier,
        type,
      });
    }

    // ✅ weekKey avec semaine qui débute dimanche 08:00 (APP_TZ)
    const anchoredNow = weekAnchorDate(new Date());
    const weekKey = getWeekKeyInTz(anchoredNow, APP_TZ);

    // weekly usage doc
    const usageId = `${uid}_${weekKey}`;
    const usageRef = db.doc(`usage_weekly/${usageId}`);

    // game date
    const gameDateYmd = normalizeGameDate(input.gameDate); // "YYYY-MM-DD"

    // ✅ ID: 2025_12_30_3x3_idRandom
    const idDate = ymdToUnderscore(gameDateYmd);
    const defiId = `${idDate}_${formatDefiKey(type)}_${randSuffix(10)}`;

    const defiRef = db.doc(`defis/${defiId}`);

    const limits = weeklyLimitsForTier(tier);

    await db.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      const usage = usageSnap.exists ? usageSnap.data() || {} : {};
      const createdCount = Number(usage.createdCount || 0);

      if (createdCount >= limits.maxCreates) {
        throw new HttpsError("resource-exhausted", "CREATE_LIMIT_REACHED", {
          reason: "CREATE_LIMIT_REACHED",
          tier,
          max: limits.maxCreates,
        });
      }

      const existing = await tx.get(defiRef);
      if (existing.exists) {
        throw new HttpsError("already-exists", "Un défi avec cet id existe déjà.");
      }

      const payload = {
        groupId,
        title,
        type,
        gameDate: gameDateYmd,
        createdBy: uid,
        participationCost,
        status,

        firstGameUTC: toDateOrNull(input.firstGameUTC) || undefined,
        signupDeadline: toDateOrNull(input.signupDeadline) || undefined,

        defiKey: `${gameDateYmd}_${formatDefiKey(type)}`,
        format: input.format || undefined,
        availability: input.availability || undefined,
        bonusReward: input.bonusReward || undefined,
        isSpecial: typeof input.isSpecial === "boolean" ? input.isSpecial : undefined,

        participantsCount: 0,
        pot: 0,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      tx.set(defiRef, payload);

      tx.set(
        usageRef,
        {
          uid,
          weekKey,
          createdCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    logger.info("[defisCreate] success", { uid, defiId, weekKey, tier });

    // ✅ Envelope standard (compatible avec ton client qui attend res.ok)
    return { ok: true, data: { id: defiId, weekKey, tier } };
  } catch (e) {
    // Log exhaustif
    logger.error("[defisCreate] error", {
      uid,
      message: String(e?.message || e),
      code: e?.code,
      details: e?.details,
      name: e?.name,
      stack: e?.stack,
    });

    // Si c'est déjà un HttpsError, on le relance tel quel
    if (e instanceof HttpsError) throw e;

    // Sinon: erreur inattendue
    throw new HttpsError("internal", "Erreur interne defisCreate.", {
      reason: "UNEXPECTED",
      message: String(e?.message || e),
    });
  }
});