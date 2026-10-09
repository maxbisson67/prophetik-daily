import test from "node:test";
import assert from "node:assert/strict";
import { parseParticipation } from "./leaderboard.js";

test("parseParticipation: potInc = NHL finalPoints for season TRIO", () => {
  const r = parseParticipation({
    finalPoints: 8,
    livePoints: 8,
    payout: 27,
    bonus: 0,
    isWinner: true,
  });
  assert.equal(r.potInc, 8);
  assert.equal(r.payout, 27);
});

test("parseParticipation: sums nights via rebuild (caller adds each potInc)", () => {
  const a = parseParticipation({ finalPoints: 1, payout: 0 });
  const b = parseParticipation({ finalPoints: 8, payout: 27 });
  assert.equal(a.potInc + b.potInc, 9);
});
