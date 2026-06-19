/**
 * Phase 3 — Autopilot TP bundle (non déployé en v1)
 *
 * Job planifié le matin (ex. 6h Toronto) :
 * 1. Query groups where autopilotEnabled === true
 * 2. Pour chaque groupe, ligue = group.sport
 * 3. Si bundle tpb_{league}_{groupId}_{gameYmd} absent :
 *    - selectGamesForTpBundle + buildBundleGamesFromSelection
 *    - écrire team_prediction_bundles avec autopilotCreated: true, createdBy: "system"
 *
 * Réutilise :
 * - loadEligibleScheduleGames
 * - selectGamesForTpBundle
 * - buildBundleGamesFromSelection
 * - defaultBundlePayload
 * - buildTeamPredictionBundleId
 *
 * Voir createDailyFgcAutopilot.js pour le pattern scheduler + notifications.
 */

export const TP_BUNDLE_AUTOPILOT_SCHEDULE = "0 6 * * *";
