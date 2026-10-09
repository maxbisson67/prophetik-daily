import assert from "node:assert/strict";
import {
  DEFAULT_POOL_RANK_USES_PREVIOUS_UNTIL_YMD,
  resolveNhlPoolRankSeasonForGame,
} from "./nhlPoolRankSeason.js";

function testUntilInclusive() {
  const onUntil = resolveNhlPoolRankSeasonForGame({ gameDateYmd: "2026-10-14" });
  assert.equal(onUntil.usedPreviousForRank, true);
  assert.equal(onUntil.rankSeasonId, "20252026");
  assert.equal(onUntil.calendarSeasonId, "20262027");

  const after = resolveNhlPoolRankSeasonForGame({ gameDateYmd: "2026-10-15" });
  assert.equal(after.usedPreviousForRank, false);
  assert.equal(after.rankSeasonId, "20262027");
}

function testConfigOverride() {
  const r = resolveNhlPoolRankSeasonForGame({
    gameDateYmd: "2026-11-01",
    seasonConfig: { poolRankUsesPreviousUntilYmd: "2026-12-31" },
  });
  assert.equal(r.usedPreviousForRank, true);
  assert.equal(r.poolRankUsesPreviousUntilYmd, "2026-12-31");
}

function testDefaultConstant() {
  assert.equal(DEFAULT_POOL_RANK_USES_PREVIOUS_UNTIL_YMD, "2026-10-14");
}

testUntilInclusive();
testConfigOverride();
testDefaultConstant();
console.log("nhlPoolRankSeason.test.js OK");
