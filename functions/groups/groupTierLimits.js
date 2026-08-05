import {
  getPlanLimits,
  getUserPlanLimits,
  normalizePlanTier,
  novaQuotaPeriodKey,
  readUserPlanTier,
} from "../subscriptions/planLimits.js";
import {
  countAutopilotOwnedGroups,
  countOwnedGroups,
  listOwnedGroups,
} from "./groupOwnership.js";
import { isAutopilotOverLimit, isActiveParticipationOverLimit } from "./planEnforcement.js";
import { countActiveParticipations } from "./participationUtils.js";

export { getPlanLimits, getUserPlanLimits, normalizePlanTier, readUserPlanTier };
export {
  assertCanCreateOwnedGroup,
  assertCanSetAutopilot,
} from "./planEnforcement.js";
export { listOwnedGroups, countOwnedGroups, countAutopilotOwnedGroups } from "./groupOwnership.js";

/** @deprecated Préférer getPlanLimits(tier).ownedGroupsLimit */
export function getGroupLimitForTier(tier) {
  return getPlanLimits(tier).ownedGroupsLimit;
}

export function getOwnedGroupsLimitForTier(tier) {
  return getPlanLimits(tier).ownedGroupsLimit;
}

export async function readNovaAdviceUsage(db, uid, period = novaQuotaPeriodKey()) {
  const snap = await db.doc(`nova_quotas/${uid}_${period}`).get();
  const counts = snap.exists ? snap.data()?.counts || {} : {};
  const coachUsed = Number(counts.coach) || 0;
  const explainLlmUsed = Number(counts.explain_llm) || 0;

  return {
    period,
    novaAdviceUsed: coachUsed,
    novaExplainLlmUsed: explainLlmUsed,
  };
}

export async function getUserPlanUsage(db, uid) {
  const {
    tier,
    activeGroupsLimit,
    ownedGroupsLimit,
    autopilotGroupsLimit,
    novaAdviceMonthlyLimit,
  } = await getUserPlanLimits(db, uid);
  const ownedGroupsCount = await countOwnedGroups(db, uid);
  const autopilotGroupsCount = await countAutopilotOwnedGroups(db, uid);
  const activeParticipationsCount = await countActiveParticipations(db, uid);
  const novaUsage = await readNovaAdviceUsage(db, uid);

  return {
    tier,
    limits: {
      activeGroupsLimit,
      ownedGroupsLimit,
      autopilotGroupsLimit,
      novaAdviceMonthlyLimit,
    },
    usage: {
      activeParticipationsCount,
      ownedGroupsCount,
      autopilotGroupsCount,
      novaAdviceUsed: novaUsage.novaAdviceUsed,
    },
    flags: {
      needsParticipationResolution: isActiveParticipationOverLimit(
        activeParticipationsCount,
        tier
      ),
      needsAutopilotResolution: isAutopilotOverLimit(autopilotGroupsCount, tier),
      canJoinOrActivateParticipation: activeParticipationsCount < activeGroupsLimit,
    },
    period: novaUsage.period,
  };
}

/** @deprecated Les groupes rejoints ne sont plus limités par l'abonnement. */
export async function assertCanAddGroupMembership() {
  return { tier: "free", current: 0, max: Number.POSITIVE_INFINITY };
}
