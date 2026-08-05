/** Limites d'abonnement — aligné sur functions/subscriptions/planLimits.js */
export const PLAN_LIMITS = {
  free: {
    activeGroupsLimit: 1,
    autopilotGroupsLimit: 1,
    novaAdviceMonthlyLimit: 30,
  },
  pro: {
    activeGroupsLimit: 5,
    autopilotGroupsLimit: 5,
    novaAdviceMonthlyLimit: 100,
  },
  vip: {
    activeGroupsLimit: 20,
    autopilotGroupsLimit: 20,
    novaAdviceMonthlyLimit: 250,
  },
};

export function normalizePlanTier(tier, active = true) {
  const t = String(tier || "free").toLowerCase();
  const normalized = t === "vip" ? "vip" : t === "pro" ? "pro" : "free";
  return active === false ? "free" : normalized;
}

export function getPlanLimits(tier, active = true) {
  const key = normalizePlanTier(tier, active);
  return PLAN_LIMITS[key] || PLAN_LIMITS.free;
}

export function planTierLabel(tier, t = (k, o) => k) {
  const key = normalizePlanTier(tier);
  if (key === "vip") {
    return t("subscriptions.plans.vip.title", { defaultValue: "Vip" });
  }
  if (key === "pro") {
    return t("subscriptions.plans.pro.title", { defaultValue: "Pro" });
  }
  return t("subscriptions.plans.free.title", { defaultValue: "Gratuit" });
}
