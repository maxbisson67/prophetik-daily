import { HttpsError } from "firebase-functions/v2/https";
import { getPlanLimits, normalizePlanTier } from "../subscriptions/planLimits.js";
import { countAutopilotOwnedGroups, countOwnedGroups } from "./groupOwnership.js";

export function throwOwnedGroupLimitReached({ tier, current, max }) {
  throw new HttpsError("failed-precondition", "OWNED_GROUP_LIMIT_REACHED", {
    tier,
    current,
    max,
  });
}

export function throwAutopilotGroupLimitReached({ tier, current, max }) {
  throw new HttpsError("failed-precondition", "AUTOPILOT_GROUP_LIMIT_REACHED", {
    tier,
    current,
    max,
  });
}

export function throwAutopilotResolutionRequired({ tier, current, max }) {
  throw new HttpsError("failed-precondition", "AUTOPILOT_RESOLUTION_REQUIRED", {
    tier,
    current,
    max,
  });
}

export async function assertCanCreateOwnedGroup(db, uid, tier) {
  const limits = getPlanLimits(tier);
  const max = limits.ownedGroupsLimit;
  const current = await countOwnedGroups(db, uid, max + 1);

  if (current >= max) {
    throwOwnedGroupLimitReached({ tier: normalizePlanTier(tier), current, max });
  }

  return { tier: normalizePlanTier(tier), current, max };
}

/**
 * Valide l'activation d'Autopilot (désactivation toujours permise).
 * @param {{ currentlyEnabled: boolean, nextEnabled: boolean }}
 */
export async function assertCanSetAutopilot(db, uid, tier, { currentlyEnabled, nextEnabled }) {
  if (!nextEnabled) {
    return { tier: normalizePlanTier(tier), allowed: true, action: "disable" };
  }

  const normalizedTier = normalizePlanTier(tier);
  const limits = getPlanLimits(normalizedTier);
  const max = limits.autopilotGroupsLimit;
  const autopilotCount = await countAutopilotOwnedGroups(db, uid);

  if (autopilotCount > max) {
    throwAutopilotResolutionRequired({
      tier: normalizedTier,
      current: autopilotCount,
      max,
    });
  }

  if (currentlyEnabled) {
    return { tier: normalizedTier, allowed: true, action: "keep" };
  }

  if (autopilotCount >= max) {
    throwAutopilotGroupLimitReached({
      tier: normalizedTier,
      current: autopilotCount,
      max,
    });
  }

  return { tier: normalizedTier, allowed: true, action: "enable" };
}

export function isActiveParticipationOverLimit(activeCount, tier) {
  const max = getPlanLimits(tier).activeGroupsLimit;
  return activeCount > max;
}

export function isAutopilotOverLimit(autopilotCount, tier) {
  const max = getPlanLimits(tier).autopilotGroupsLimit;
  return autopilotCount > max;
}
