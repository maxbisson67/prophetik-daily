import test from "node:test";
import assert from "node:assert/strict";
import {
  tsDefiCountsForStats,
  tsDefiEligibleForDailyTotals,
} from "./tsDefiStatsEligibility.js";

test("tsDefiCountsForStats — completed oui, NO_HUMANS oui", () => {
  assert.equal(tsDefiCountsForStats({ status: "completed" }), true);
  assert.equal(
    tsDefiCountsForStats({ status: "cancelled", cancelReason: "NO_HUMANS" }),
    true
  );
  assert.equal(
    tsDefiCountsForStats({ status: "cancelled", cancelReason: "NO_PARTICIPANTS" }),
    false
  );
});

test("tsDefiEligibleForDailyTotals — inclut live et NO_HUMANS", () => {
  assert.equal(tsDefiEligibleForDailyTotals({ status: "live" }), true);
  assert.equal(
    tsDefiEligibleForDailyTotals({ status: "cancelled", cancelReason: "NO_HUMANS" }),
    true
  );
  assert.equal(
    tsDefiEligibleForDailyTotals({ status: "cancelled", cancelReason: "OTHER" }),
    false
  );
});
