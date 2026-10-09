import assert from "node:assert/strict";
import test from "node:test";
import {
  getFgcPlayerSortStat,
  poolHasRepresentativeCurrentSeason,
  resolveFgcPlayerSortMeta,
} from "./fgcPlayerSortSeason.js";

test("NHL sort uses previous season until pool rank cutoff", () => {
  const meta = resolveFgcPlayerSortMeta({
    league: "NHL",
    gameDateYmd: "2026-10-01",
    seasonPair: { current: "20262027", previous: "20252026" },
    players: [],
  });
  assert.equal(meta.sortSeasonId, "20252026");
  assert.equal(meta.sortUsesPreviousSeason, true);
});

test("NHL sort switches to current after cutoff when pool has sample", () => {
  const players = Array.from({ length: 12 }, (_, i) => ({
    statsBySeason: {
      "20262027": { points: i + 1, gamesPlayed: 6 },
    },
  }));
  const meta = resolveFgcPlayerSortMeta({
    league: "NHL",
    gameDateYmd: "2026-11-01",
    seasonPair: { current: "20262027", previous: "20252026" },
    players,
  });
  assert.equal(meta.sortSeasonId, "20262027");
  assert.equal(meta.sortUsesPreviousSeason, false);
});

test("NHL keeps previous when current pool is still sparse after cutoff", () => {
  const players = [{ statsBySeason: { "20262027": { points: 1, gamesPlayed: 1 } } }];
  const meta = resolveFgcPlayerSortMeta({
    league: "NHL",
    gameDateYmd: "2026-11-01",
    seasonPair: { current: "20262027", previous: "20252026" },
    players,
  });
  assert.equal(meta.sortSeasonId, "20252026");
  assert.equal(meta.sortUsesPreviousSeason, true);
});

test("getFgcPlayerSortStat uses goals per game for NHL", () => {
  const sniper = getFgcPlayerSortStat(
    { statsBySeason: { "20252026": { goals: 5, gamesPlayed: 20 } } },
    "NHL",
    "20252026"
  );
  const volume = getFgcPlayerSortStat(
    { statsBySeason: { "20252026": { goals: 10, gamesPlayed: 82 } } },
    "NHL",
    "20252026"
  );
  assert.equal(sniper, 0.25);
  assert.ok(sniper > volume);
});

test("poolHasRepresentativeCurrentSeason needs enough players", () => {
  const few = [{ statsBySeason: { "2026": { rbi: 1 } } }];
  const many = Array.from({ length: 10 }, () => ({
    statsBySeason: { "2026": { rbi: 2, gamesPlayed: 5 } },
  }));
  assert.equal(poolHasRepresentativeCurrentSeason(few, "MLB", "2026"), false);
  assert.equal(poolHasRepresentativeCurrentSeason(many, "MLB", "2026"), true);
});
