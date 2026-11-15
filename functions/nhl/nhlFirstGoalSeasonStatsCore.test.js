import test from "node:test";
import assert from "node:assert/strict";
import {
  computeFirstValidGoalFromPbpPlays,
  isNhlScheduleGameFinal,
  iterateYmdInclusive,
} from "./nhlFirstGoalSeasonStatsCore.js";

test("isNhlScheduleGameFinal", () => {
  assert.equal(isNhlScheduleGameFinal("OFF"), true);
  assert.equal(isNhlScheduleGameFinal("FINAL"), true);
  assert.equal(isNhlScheduleGameFinal("FUT"), false);
});

test("iterateYmdInclusive", () => {
  assert.deepEqual(iterateYmdInclusive("2026-11-01", "2026-11-03"), [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
  ]);
});

test("computeFirstValidGoalFromPbpPlays picks earliest non-SO goal", () => {
  const plays = [
    {
      typeDescKey: "goal",
      eventId: "200",
      periodDescriptor: { number: 2, periodType: "REG" },
      details: {
        scoringPlayerId: 2,
        timeInPeriod: "10:00",
        teamAbbrev: "TOR",
      },
    },
    {
      typeDescKey: "goal",
      eventId: "100",
      periodDescriptor: { number: 1, periodType: "REG" },
      details: {
        scoringPlayerId: 1,
        timeInPeriod: "05:00",
        teamAbbrev: "MTL",
      },
    },
    {
      typeDescKey: "goal",
      eventId: "300",
      periodDescriptor: { number: 5, periodType: "SO" },
      details: {
        scoringPlayerId: 99,
        timeInPeriod: "00:00",
        teamAbbrev: "MTL",
      },
    },
  ];

  const first = computeFirstValidGoalFromPbpPlays(plays);
  assert.equal(first.scoringPlayerId, "1");
  assert.equal(first.teamAbbr, "MTL");
});
