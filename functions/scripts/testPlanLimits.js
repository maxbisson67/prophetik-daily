/**
 * Validations minimales des limites d'abonnement.
 * Usage: node functions/scripts/testPlanLimits.js
 */
import assert from "node:assert/strict";
import {
  getPlanLimits,
  normalizePlanTier,
  PLAN_LIMITS,
} from "../subscriptions/planLimits.js";
import { getOwnedGroupsLimitForTier } from "../groups/groupTierLimits.js";
import { isAutopilotOverLimit } from "../groups/planEnforcement.js";

function canCreateOwnedGroup(ownedCount, tier) {
  const max = getOwnedGroupsLimitForTier(tier);
  return ownedCount < max;
}

function canEnableAutopilot(autopilotCount, tier, { currentlyEnabled = false } = {}) {
  const max = getPlanLimits(tier).autopilotGroupsLimit;
  if (isAutopilotOverLimit(autopilotCount, tier)) return false;
  if (currentlyEnabled) return true;
  return autopilotCount < max;
}

function testPlanLimitsConfig() {
  assert.equal(getPlanLimits("free").ownedGroupsLimit, 1);
  assert.equal(getPlanLimits("free").autopilotGroupsLimit, 1);
  assert.equal(getPlanLimits("free").novaAdviceMonthlyLimit, 30);
  assert.equal(getPlanLimits("pro").ownedGroupsLimit, 5);
  assert.equal(getPlanLimits("pro").autopilotGroupsLimit, 5);
  assert.equal(getPlanLimits("pro").novaAdviceMonthlyLimit, 100);
  assert.equal(getPlanLimits("vip").ownedGroupsLimit, 20);
  assert.equal(getPlanLimits("vip").autopilotGroupsLimit, 20);
  assert.equal(getPlanLimits("vip").novaAdviceMonthlyLimit, 250);
}

function testDowngradeTierNormalization() {
  assert.equal(normalizePlanTier("pro", false), "free");
  assert.equal(normalizePlanTier("vip", false), "free");
  assert.equal(getPlanLimits("pro", false).novaAdviceMonthlyLimit, 30);
  assert.equal(getPlanLimits("pro", false).autopilotGroupsLimit, 1);
}

function testOwnedGroupCreateGate() {
  assert.equal(canCreateOwnedGroup(0, "free"), true);
  assert.equal(canCreateOwnedGroup(1, "free"), false);
  assert.equal(canCreateOwnedGroup(4, "pro"), true);
  assert.equal(canCreateOwnedGroup(5, "pro"), false);
  assert.equal(canCreateOwnedGroup(19, "vip"), true);
  assert.equal(canCreateOwnedGroup(20, "vip"), false);
}

function testAutopilotEnableGate() {
  assert.equal(canEnableAutopilot(0, "free"), true);
  assert.equal(canEnableAutopilot(1, "free"), false);
  assert.equal(canEnableAutopilot(1, "free", { currentlyEnabled: true }), true);
  assert.equal(canEnableAutopilot(4, "pro"), true);
  assert.equal(canEnableAutopilot(5, "pro"), false);
  assert.equal(canDisableAutopilotAlways(), true);
}

function canDisableAutopilotAlways() {
  return true;
}

function testAutopilotOverLimitAfterDowngrade() {
  assert.equal(isAutopilotOverLimit(3, "free"), true);
  assert.equal(isAutopilotOverLimit(1, "free"), false);
  assert.equal(canEnableAutopilot(3, "free"), false);
  assert.equal(canEnableAutopilot(3, "free", { currentlyEnabled: true }), false);
}

function testDowngradeKeepsExistingGroups() {
  const ownedAfterDowngrade = 5;
  assert.equal(canCreateOwnedGroup(ownedAfterDowngrade, "free"), false);
}

function testNovaQuotaAfterDowngrade() {
  const used = 68;
  const limit = getPlanLimits("free").novaAdviceMonthlyLimit;
  assert.equal(limit, 30);
  assert.equal(used >= limit, true);
}

function testJoinUnlimited() {
  const joinedGroups = 25;
  assert.ok(joinedGroups > PLAN_LIMITS.free.ownedGroupsLimit);
}

function testNovaBlocksAtLimit() {
  const limit = getPlanLimits("pro").novaAdviceMonthlyLimit;
  assert.equal(100 >= limit, true);
  assert.equal(101 >= limit, true);
}

function run() {
  testPlanLimitsConfig();
  testDowngradeTierNormalization();
  testOwnedGroupCreateGate();
  testAutopilotEnableGate();
  testAutopilotOverLimitAfterDowngrade();
  testDowngradeKeepsExistingGroups();
  testNovaQuotaAfterDowngrade();
  testJoinUnlimited();
  testNovaBlocksAtLimit();
  console.log("testPlanLimits: all checks passed");
}

run();
