/** Feature flags Pack A + live index shadow (env / Firebase params). */

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const v = String(raw).toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return defaultValue;
}

function envInt(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

export function getFirestoreCostFlags() {
  return {
    /** #2 — skip crons 1 min hors fenêtre live si ligues idle et aucun défi actif. */
    cronIdleGate: envFlag("CRON_IDLE_GATE", true),
    /** #3 — fenêtre finalize TS (défaut 7 en prod Pack A). */
    finalizeCatchupDays: envInt("FINALIZE_CATCHUP_DAYS", 7),
    /** #4 — rank avant payout seulement si crédit leaderboard plausible. */
    finalizeRankSnapshot: envFlag("FINALIZE_RANK_SNAPSHOT", true),
    /** #1 — lire lastHumanParticipationYmd au lieu de scanner entries (fallback si absent). */
    autopilotInactivityUseDenorm: envFlag("AUTOPILOT_INACTIVITY_USE_DENORM", true),
    /** #5 — écrire internal/live_index (lecture = LIVE_USE_INDEX, plus tard). */
    liveIndexShadowWrite: envFlag("LIVE_INDEX_SHADOW_WRITE", true),
    /** #5 — ne pas activer avant flip validé. */
    liveUseIndex: envFlag("LIVE_USE_INDEX", false),
  };
}
