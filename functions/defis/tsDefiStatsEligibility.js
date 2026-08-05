/**
 * Défis TRIO éligibles pour compter les points de stats (sans cagnotte).
 * - completed : finalize normal
 * - cancelled + NO_HUMANS : Nova seule inscrite, stats conservées
 */
export function tsDefiCountsForStats(defi = {}) {
  const status = String(defi?.status || "").toLowerCase();
  if (["deleted", "archived"].includes(status)) return false;
  if (status === "completed") return true;
  if (status === "cancelled" || status === "canceled") {
    return String(defi?.cancelReason || "").toUpperCase() === "NO_HUMANS";
  }
  return false;
}

/** Cumul du soir : inclut aussi les défis en cours (open / live). */
export function tsDefiEligibleForDailyTotals(defi = {}) {
  if (tsDefiCountsForStats(defi)) return true;
  const status = String(defi?.status || "").toLowerCase();
  return !["cancelled", "canceled", "deleted", "archived"].includes(status);
}
