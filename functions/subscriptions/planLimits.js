/**
 * Limites de forfait Prophetik — source de vérité serveur.
 * Ajouter de nouvelles capacités ici (ex. advancedStats, premiumThemes).
 */
export const PLAN_TIERS = ["free", "pro", "vip"];

export const PLAN_LIMITS = {
  free: {
    activeGroupsLimit: 1,
    ownedGroupsLimit: 1,
    autopilotGroupsLimit: 1,
    novaAdviceMonthlyLimit: 30,
    novaExplainLlmMonthlyLimit: 30,
  },
  pro: {
    activeGroupsLimit: 5,
    ownedGroupsLimit: 5,
    autopilotGroupsLimit: 5,
    novaAdviceMonthlyLimit: 100,
    novaExplainLlmMonthlyLimit: 60,
  },
  vip: {
    activeGroupsLimit: 20,
    ownedGroupsLimit: 20,
    autopilotGroupsLimit: 20,
    novaAdviceMonthlyLimit: 250,
    novaExplainLlmMonthlyLimit: 120,
  },
};

export function normalizePlanTier(tier, active = true) {
  const t = String(tier || "free").toLowerCase();
  const normalized = t === "vip" ? "vip" : t === "pro" ? "pro" : "free";
  return active === false ? "free" : normalized;
}

export function getPlanLimits(planOrTier, active = true) {
  const tier = normalizePlanTier(planOrTier, active);
  return { ...(PLAN_LIMITS[tier] || PLAN_LIMITS.free) };
}

export async function readUserPlanTier(db, uid) {
  const snap = await db.doc(`entitlements/${uid}`).get();
  if (!snap.exists) return "free";

  const d = snap.data() || {};
  return normalizePlanTier(d.tier, d.active);
}

export async function getUserPlanLimits(db, uid) {
  const tier = await readUserPlanTier(db, uid);
  return {
    tier,
    ...getPlanLimits(tier, true),
  };
}

export function novaQuotaPeriodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
