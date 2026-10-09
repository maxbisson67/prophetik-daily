import test from "node:test";
import assert from "node:assert/strict";
import { extractScoringPlaysFromFeed, extractRunScorersFromPlay, isMlbPlayScoringEvent } from "./mlbLiveGamesSchema.js";

test("isMlbPlayScoringEvent detects RBI and unearned runs without RBI", () => {
  assert.equal(
    isMlbPlayScoringEvent({
      result: { rbi: 1, eventType: "home_run" },
      runners: [{ details: { isScoringEvent: true, rbi: true } }],
    }),
    true
  );

  assert.equal(
    isMlbPlayScoringEvent({
      result: { rbi: 0, eventType: "fielders_choice" },
      runners: [{ details: { isScoringEvent: true, rbi: false } }],
    }),
    true
  );

  assert.equal(
    isMlbPlayScoringEvent({
      result: { rbi: 0, eventType: "single" },
      runners: [],
    }),
    false
  );
});

test("extractScoringPlaysFromFeed keeps only plays that actually score", () => {
  const feed = {
    gameData: {
      teams: {
        away: { abbreviation: "KC" },
        home: { abbreviation: "TOR" },
      },
    },
    liveData: {
      plays: {
        allPlays: [
          {
            about: { atBatIndex: 0, inning: 1, halfInning: "top" },
            matchup: { batter: { id: 1, fullName: "Carter Jensen" } },
            result: {
              event: "Home Run",
              eventType: "home_run",
              rbi: 1,
              awayScore: 1,
              homeScore: 0,
              description: "Carter Jensen homers (18) on a fly ball to right field.",
            },
            runners: [
              {
                details: {
                  isScoringEvent: true,
                  rbi: true,
                  runner: { id: 1, fullName: "Carter Jensen" },
                },
              },
            ],
          },
          {
            about: { atBatIndex: 1, inning: 1, halfInning: "top" },
            matchup: { batter: { id: 2, fullName: "Bobby Witt Jr." } },
            result: {
              event: "Single",
              eventType: "single",
              rbi: 0,
              awayScore: 1,
              homeScore: 0,
              description: "Bobby Witt Jr. singles on a fly ball to center fielder Myles Straw.",
            },
            runners: [],
          },
          {
            about: { atBatIndex: 4, inning: 1, halfInning: "top" },
            matchup: { batter: { id: 3, fullName: "Salvador Perez" } },
            result: {
              event: "Fielders Choice",
              eventType: "fielders_choice",
              rbi: 0,
              awayScore: 2,
              homeScore: 0,
              description:
                "Salvador Perez reaches on a fielder's choice. Bobby Witt Jr. scores. Jac Caglianone to 2nd. Fielding error by pitcher Spencer Arrighetti.",
            },
            runners: [
              {
                details: {
                  isScoringEvent: true,
                  rbi: false,
                  runner: { id: 2, fullName: "Bobby Witt Jr." },
                },
              },
            ],
          },
        ],
      },
    },
  };

  const plays = extractScoringPlaysFromFeed(feed, "822771");

  assert.equal(plays.length, 2);
  assert.equal(plays[0].batterName, "Carter Jensen");
  assert.equal(plays[0].awayScore, 1);
  assert.equal(plays[0].atBatIndex, 0);
  assert.equal(plays[1].batterName, "Salvador Perez");
  assert.equal(plays[1].awayScore, 2);
  assert.equal(plays[1].rbi, 0);
  assert.deepEqual(plays[0].runScorers, [{ playerId: "1", name: "Carter Jensen" }]);
  assert.deepEqual(plays[1].runScorers, [{ playerId: "2", name: "Bobby Witt Jr." }]);
});

test("extractRunScorersFromPlay deduplicates repeated scoring runner entries", () => {
  const scorers = extractRunScorersFromPlay({
    runners: [
      {
        details: {
          isScoringEvent: true,
          runner: { id: 10, fullName: "Josh Rojas" },
        },
      },
      {
        details: {
          isScoringEvent: false,
          runner: { id: 10, fullName: "Josh Rojas" },
        },
      },
      {
        details: {
          isScoringEvent: true,
          runner: { id: 10, fullName: "Josh Rojas" },
        },
      },
    ],
  });

  assert.deepEqual(scorers, [{ playerId: "10", name: "Josh Rojas" }]);
});
