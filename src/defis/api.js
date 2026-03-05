// src/defis/api.js (RNFB)
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import i18n from "@src/i18n/i18n";

const APP_TZ = "America/Toronto"; // aligné backend

/* -------------------- helpers -------------------- */

async function isGroupMemberOrOwnerClientCheck(groupId, uid) {
  try {
    if (!groupId || !uid) return false;

    const gmRef = firestore().doc(`group_memberships/${groupId}_${uid}`);
    const gmSnap = await gmRef.get();
    if (gmSnap.exists) {
      const gm = gmSnap.data() || {};
      const isActive = gm.active !== false;
      const role = String(gm.role || "member").toLowerCase();
      if (isActive && (role === "member" || role === "owner")) return true;
    }

    const gRef = firestore().doc(`groups/${String(groupId)}`);
    const gSnap = await gRef.get();
    if (gSnap.exists && gSnap.data()?.ownerId === uid) return true;

    return false;
  } catch (e) {
    console.warn("[isGroupMemberOrOwnerClientCheck]", e?.code || e?.message || e);
    return false;
  }
}

function normalizeGameDate(gameDate) {
  if (!gameDate) throw new Error("gameDate requis");

  if (typeof gameDate === "string") {
    if (gameDate.length >= 10) return gameDate.slice(0, 10);
    throw new Error('gameDate string doit être au format "YYYY-MM-DD"');
  }

  if (gameDate instanceof Date) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(gameDate);

      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const d = parts.find((p) => p.type === "day")?.value;
      if (!y || !m || !d) throw new Error("formatToParts incomplet");
      return `${y}-${m}-${d}`;
    } catch (e) {
      console.warn("[normalizeGameDate] Intl error, fallback local getters", e);
      const y = gameDate.getFullYear();
      const m = String(gameDate.getMonth() + 1).padStart(2, "0");
      const d = String(gameDate.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  throw new Error('gameDate doit être une string "YYYY-MM-DD" ou un Date');
}

function toIsoOrNull(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : v?.toDate?.() ? v.toDate() : new Date(v);
  return Number.isFinite(d?.getTime?.()) ? d.toISOString() : null;
}

function friendlyCallableError(e) {
  const details = e?.details || {};
  const reason = details.reason;

  switch (reason) {
    case "PLAN_NOT_ALLOWED":
      return i18n.t("groups.defi.errors.planNotAllowed");

    case "CREATE_LIMIT_REACHED":
      return i18n.t("groups.defi.errors.createLimitReached", {
        max: details.max,
      });

    case "JOIN_LIMIT_REACHED":
      return i18n.t("groups.defi.errors.joinLimitReached", {
        max: details.max,
      });

    case "DATE_NOT_ELIGIBLE":
      return i18n.t("groups.defi.errors.dateNotEligible");

    default:
      // fallback safe
      return i18n.t("common.genericError");
  }
}

/* -------------------- callables -------------------- */

function callDefisCreate() {
  return functions().httpsCallable("defisCreate");
}

function callDefisJoin() {
  return functions().httpsCallable("defisJoin");
}

function parseCallableError(e) {
  const details = e?.details || {};
  return {
    code: e?.code || null,
    message: e?.message || null,
    reason: details.reason || null,
    max: details.max ?? null,
  };
}

/* -------------------- API -------------------- */

/**
 * Crée un défi via Cloud Function (source de vérité + quotas + tiers).
 * Input: { groupId, title, type, gameDate, participationCost?, status?, firstGameUTC?, signupDeadline?, format?, availability?, bonusReward?, isSpecial? }
 * Retour: { id, weekKey, tier }
 */
export async function createDefi(input = {}) {
  const {
    groupId,
    title,
    type,
    gameDate, // string ou Date
    participationCost,
    status = "active",
    firstGameUTC = null,
    signupDeadline = null,
    format,
    availability,
    bonusReward,
    isSpecial,
    // ⚠️ createdBy volontairement ignoré (req.auth.uid = source de vérité)
    createdBy,
  } = input;

  if (!groupId) throw new Error("groupId requis");
  if (!title) throw new Error("title requis");
  if (!Number.isFinite(Number(type)) || Number(type) <= 0) throw new Error("type requis");
  if (!gameDate) throw new Error("gameDate requis");

  // UI-only check (optionnel)
  if (createdBy) {
    const ok = await isGroupMemberOrOwnerClientCheck(groupId, createdBy);
    if (!ok) throw new Error("Création refusée: utilisateur non membre/owner actif du groupe.");
  }

  const payload = {
    groupId: String(groupId),
    title: String(title),
    type: Number(type),
    gameDate: normalizeGameDate(gameDate),
    participationCost: participationCost ?? null,
    status: String(status),

    // ISO strings
    firstGameUTC: toIsoOrNull(firstGameUTC),
    signupDeadline: toIsoOrNull(signupDeadline),

    // ✅ préfère undefined plutôt que null (plus clean)
    format: format ?? undefined,
    availability: availability ?? undefined,
    bonusReward: bonusReward ?? undefined,
    isSpecial: typeof isSpecial === "boolean" ? isSpecial : undefined,
  };

  try {
    const fn = callDefisCreate();
    const res = await fn(payload);
    return res?.data || null;
  } catch (e) {
    return { ok: false, error: parseCallableError(e) };
  }
}

/**
 * Join un défi via Cloud Function.
 * Input: { defiId }
 * Retour: { ok, defiId, weekKey, tier }
 */
/** Rejoindre un défi (débite stakes) */
export async function joinDefi(defiId, { picks = [], clientMutationId = null } = {}) {
  const id = String(defiId || "");
  if (!id) throw new Error("defiId requis");

  try {
    const fn = callDefisJoin();
    const res = await fn({ defiId: id, picks, clientMutationId });
    return res?.data || null;
  } catch (e) {
    return { ok: false, error: parseCallableError(e) };
  }
}