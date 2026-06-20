/**
 * TP bundle autopilot is implemented in:
 *   functions/autopilot/createDailyFgcAutopilot.js
 *
 * The daily group autopilot job creates FGC + TP bundles (and future challenge types)
 * in one pass, then sends a single combined push notification per group.
 *
 * Helpers:
 *   - functions/autopilot/createTpBundleForGroup.js
 *   - functions/autopilot/autopilotNotification.js
 */

export const TP_BUNDLE_AUTOPILOT_SCHEDULE = "30 6 * * *";
