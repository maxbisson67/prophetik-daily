// functions/subscriptions/plans.js

export const PLAN_KEYS = /** @type {const} */ (["free", "base", "popular", "prophetik"]);

export function isValidPlanKey(planKey) {
  return PLAN_KEYS.includes(planKey);
}

/**
 * Source de vérité des plans côté backend.
 * NOTE: prix gérés via IAP (Apple/Google). Ici c'est pour les crédits & règles.
 */
export function getPlanConfig(planKey) {
  switch (planKey) {
    case "free":
      return {
        planKey: "free",
        monthlyCredits: 10,
        autoGrant: true,   // ✅ on a choisi simple: free auto
        freeCap: 20,       // ✅ cap uniquement appliqué au grant free mensuel
        has67: false,
      };

    case "base":
      return {
        planKey: "base",
        monthlyCredits: 30,
        autoGrant: true,
        freeCap: null,
        has67: false,
      };

    case "popular":
      return {
        planKey: "popular",
        monthlyCredits: 75,
        autoGrant: true,
        freeCap: null,
        has67: true,
      };

    case "prophetik":
      return {
        planKey: "prophetik",
        monthlyCredits: 225,
        autoGrant: true,
        freeCap: null,
        has67: true,
      };

    default:
      return null;
  }
}