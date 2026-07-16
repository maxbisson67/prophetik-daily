/** Limites mensuelles Nova Coach — aligné sur functions/subscriptions/planLimits.js */
import { PLAN_LIMITS } from "@src/subscriptions/planLimits";

export const NOVA_COACH_MONTHLY_LIMITS = {
  free: PLAN_LIMITS.free.novaAdviceMonthlyLimit,
  pro: PLAN_LIMITS.pro.novaAdviceMonthlyLimit,
  vip: PLAN_LIMITS.vip.novaAdviceMonthlyLimit,
};

export function novaCoachMonthlyLimitForTier(tier) {
  const key = String(tier || "free").toLowerCase();
  return NOVA_COACH_MONTHLY_LIMITS[key] ?? NOVA_COACH_MONTHLY_LIMITS.free;
}
