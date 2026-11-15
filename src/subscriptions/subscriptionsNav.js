/**
 * Navigation vers l'écran Abonnements (masqué en attendant le nouveau modèle).
 * Réactiver SUBSCRIPTIONS_UI_VISIBLE pour réafficher drawer + CTAs.
 */
export const SUBSCRIPTIONS_UI_VISIBLE = false;

export function navigateToSubscriptions(router) {
  if (!SUBSCRIPTIONS_UI_VISIBLE) return;
  router?.push?.("/(drawer)/subscriptions");
}