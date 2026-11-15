import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTeamSplitRoster,
  teamSplitHasBothTeams,
  TEAM_IDS,
} from "./groupTeamSplitCore.js";

test("teamSplitHasBothTeams: false until a and b assigned", () => {
  assert.equal(teamSplitHasBothTeams({ u1: TEAM_IDS.A }), false);
  assert.equal(
    teamSplitHasBothTeams({ u1: TEAM_IDS.A, u2: TEAM_IDS.B }),
    true
  );
});

test("normalizeTeamSplitRoster: filters ai", () => {
  assert.deepEqual(normalizeTeamSplitRoster({ u1: "a", ai: "b" }), { u1: "a" });
});
