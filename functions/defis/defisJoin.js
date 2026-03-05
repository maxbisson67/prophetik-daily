// functions/defis/defisJoin.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { APP_TZ, weekAnchorDate } from "../ProphetikDate.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

/* ----------------------------- helpers ----------------------------- */

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

  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayNum = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dayNum + 3);

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
    return { tier: String(d.tier || "free").toLowerCase(), active: d.active !== false };
  }

  const b = await db.doc(`participants/${uid}`).get();
  if (b.exists) {
    const d = b.data() || {};
    return { tier: String(d.tier || "free").toLowerCase(), active: d.subscriptionActive !== false };
  }

  return { tier: "free", active: true };
}

function weeklyLimitsForTier(tier) {
  const t = String(tier || "free").toLowerCase();
  if (t === "pro") return { maxCreates: 21, maxJoins: 21 };
  if (t === "vip") return { maxCreates: 200, maxJoins: 200 };
  return { maxCreates: 7, maxJoins: 7 };
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

// --- picks helpers (repris de participateInDefi) ---
function normalizePicks(picks) {
  const arr = Array.isArray(picks) ? picks : [];
  return arr.map((p) => ({
    playerId: String(p?.playerId ?? ""),
    fullName: String(p?.fullName ?? ""),
    teamAbbr: String(p?.teamAbbr ?? "").toUpperCase(),
  }));
}


function samePicksByPlayerId(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (String(a[i]?.playerId ?? "") !== String(b[i]?.playerId ?? "")) return false;
  }
  return true;
}

function safeNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/* ----------------------------- callable ----------------------------- */
/**
 * Input:
 * { defiId, picks?, clientMutationId? }
 */
export const defisJoin = onCall({ region: "us-central1" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth requise.");

  const defiId = String(req.data?.defiId || "");
  if (!defiId) throw new HttpsError("invalid-argument", "defiId requis.");

  const clientMutationId = req.data?.clientMutationId
    ? String(req.data.clientMutationId)
    : null;

  const picks = normalizePicks(req.data?.picks || []);

    if (!Array.isArray(picks) || picks.length === 0) {
        logger.info("[defisJoin] start: PICKS_REQUIRED", { uid, defiId });
    throw new HttpsError("invalid-argument", "PICKS_REQUIRED", {
        reason: "PICKS_REQUIRED",
    });
    }

    // Optionnel mais conseillé: refuse les playerId vides
    if (picks.some(p => !p.playerId)) {
         logger.info("[defisJoin] start: INVALID_PICKS", { uid, defiId });
    throw new HttpsError("invalid-argument", "INVALID_PICKS", {
        reason: "INVALID_PICKS",
    });
    }

  logger.info("[defisJoin] start", { uid, defiId });

  try {
    const defiRef = db.doc(`defis/${defiId}`);

    const anchoredNow = weekAnchorDate(new Date());
    const weekKey = getWeekKeyInTz(anchoredNow, APP_TZ);

    const usageRef = db.doc(`usage_weekly/${uid}_${weekKey}`);
    const partRef = db.doc(`defis/${defiId}/participations/${uid}`);

    const ent = await getUserTier(uid);
    const tier = ent.tier || "free";

    // ✅ Free ≠ "inactive". On bloque seulement si PRO/VIP et inactive.
    if (tier !== "free" && ent.active === false) {
      throw new HttpsError("failed-precondition", "SUBSCRIPTION_INACTIVE", {
        reason: "SUBSCRIPTION_INACTIVE",
        tier,
      });
    }

    const limits = weeklyLimitsForTier(tier);
    const allowSet = allowedTypesForTier(tier);

    const result = await db.runTransaction(async (tx) => {
      const defiSnap = await tx.get(defiRef);
      if (!defiSnap.exists) throw new HttpsError("not-found", "Défi introuvable.");

      const defi = defiSnap.data() || {};
      const groupId = String(defi.groupId || "");
      if (!groupId) throw new HttpsError("failed-precondition", "Défi invalide (groupId manquant).");

      // ✅ statut doit être open (comme participateInDefi)
      const status = String(defi.status || "open").toLowerCase();
      if (status !== "open") {
        throw new HttpsError("failed-precondition", "defi is not open", {
          reason: "DEFI_NOT_OPEN",
          status,
        });
      }


      // ✅ Plan gating
      const defiType = Number(defi.type || 0);

     logger.info("[defisJoin] gating rules validation", {
        uid,
        tier,
        defiType: Number(defi.type || 0),
        allow: allowSet ? Array.from(allowSet) : "ALL",
        defiId,
    });

      if (!Number.isFinite(defiType) || defiType <= 0) {
        throw new HttpsError("failed-precondition", "Défi invalide (type manquant).");
      }
      if (allowSet && !allowSet.has(defiType)) {



        throw new HttpsError("failed-precondition", "PLAN_NOT_ALLOWED", {
          reason: "PLAN_NOT_ALLOWED",
          tier,
          type: defiType,
          defiId,
        });
      }

      // ✅ membership/owner check dans tx
      const gmRef = db.doc(`group_memberships/${groupId}_${uid}`);
      const gRef = db.doc(`groups/${groupId}`);

      const gmSnap = await tx.get(gmRef);
      let okMember = false;

      if (gmSnap.exists) {
        const d = gmSnap.data() || {};
        const isActive = d.active !== false;
        const role = String(d.role || "member").toLowerCase();
        okMember = isActive && (role === "member" || role === "owner");
      }
      if (!okMember) {
        const gSnap = await tx.get(gRef);
        if (gSnap.exists) {
          const gd = gSnap.data() || {};
          okMember = String(gd.ownerId || gd.createdBy || "") === String(uid);
        }
      }
      if (!okMember) {
        throw new HttpsError("permission-denied", "Participation refusée: non membre/owner actif.");
      }

      const partSnap = await tx.get(partRef);
      const already = partSnap.exists ? (partSnap.data() || {}) : null;

      // ✅ Idempotence
      if (clientMutationId && already?.lastMutationId === clientMutationId) {
        return {
          alreadyJoined: true,
          potIncrementApplied: false,
          weekKey,
          tier,
          newPot: safeNumber(defi.pot, 0),
        };
      }

      const now = FieldValue.serverTimestamp();
      const joinedAt = already?.joinedAt ?? now;
      const isFirstJoin = !partSnap.exists;

      // ✅ Quota weekly (joins) seulement si first join
      if (isFirstJoin) {
        const usageSnap = await tx.get(usageRef);
        const usage = usageSnap.exists ? usageSnap.data() || {} : {};
        const joinedCount = Number(usage.joinedCount || 0);

        if (joinedCount >= limits.maxJoins) {
          throw new HttpsError("resource-exhausted", "JOIN_LIMIT_REACHED", {
            reason: "JOIN_LIMIT_REACHED",
            tier,
            max: limits.maxJoins,
          });
        }
      }

      // ✅ Détecter edits (si picks changent après un premier save)
      const prevPicks = Array.isArray(already?.picks) ? already.picks : [];
      const hasPrevSave = partSnap.exists && prevPicks.length > 0;
      const changed = hasPrevSave ? !samePicksByPlayerId(prevPicks, picks) : false;

      // ✅ pot increment (sponsor) à la 1ère participation
      // priorité : potJoinIncrement -> participationCost -> type -> 1
      const potJoinIncrementRaw =
        defi.potJoinIncrement ?? defi.participationCost ?? defi.type ?? 1;
      const potJoinIncrement = safeNumber(potJoinIncrementRaw, 0);

      if (!Number.isFinite(potJoinIncrement) || potJoinIncrement < 0) {
        throw new HttpsError("failed-precondition", "invalid potJoinIncrement", {
          reason: "INVALID_POT_JOIN_INCREMENT",
        });
      }

      // ✅ upsert participation
      tx.set(
        partRef,
        {
          uid,
          picks,
          joinedAt,
          updatedAt: now,
          lastMutationId: clientMutationId || null,

          // champs compat / analytics (gardés)
          paid: false,
          paidAmount: 0,
          paidAt: null,

          livePoints: already?.livePoints ?? 0,
          liveUpdatedAt: already?.liveUpdatedAt ?? null,
          finalPoints: already?.finalPoints ?? 0,
          finalizedAt: already?.finalizedAt ?? null,
          payout: already?.payout ?? 0,

          ...(hasPrevSave && changed ? { editsCount: FieldValue.increment(1) } : {}),
        },
        { merge: true }
      );

      // ✅ agrégats defi + usage uniquement au first join
      if (isFirstJoin) {
        tx.set(
          defiRef,
          {
            participantsCount: FieldValue.increment(1),
            pot: FieldValue.increment(potJoinIncrement),
            updatedAt: now,
          },
          { merge: true }
        );

        tx.set(
          usageRef,
          {
            uid,
            weekKey,
            joinedCount: FieldValue.increment(1),
            updatedAt: now,
          },
          { merge: true }
        );
      } else {
        tx.set(defiRef, { updatedAt: now }, { merge: true });
      }

      const oldPot = safeNumber(defi.pot, 0);
      return {
        alreadyJoined: !isFirstJoin,
        potIncrementApplied: isFirstJoin,
        weekKey,
        tier,
        newPot: isFirstJoin ? oldPot + potJoinIncrement : oldPot,
      };
    });

    logger.info("[defisJoin] success", { uid, defiId, weekKey, tier });
    return { ok: true, defiId, ...result };
  } catch (e) {
    logger.error("[defisJoin] error", {
      uid,
      defiId,
      message: String(e?.message || e),
      code: e?.code,
      details: e?.details,
      stack: e?.stack,
    });

    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", "Erreur interne defisJoin.", {
      reason: "UNEXPECTED",
      message: String(e?.message || e),
    });
  }
});