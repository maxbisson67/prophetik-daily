import test from "node:test";
import assert from "node:assert/strict";
import { extractInningLinescoreFromFeed } from "./mlbLiveGamesSchema.js";

test("extractInningLinescoreFromFeed builds compact rows and signature", () => {
  const feed = {
    liveData: {
      linescore: {
        innings: [
          { num: 1, away: { runs: 0 }, home: { runs: 2 } },
          { num: 2, away: { runs: 1 }, home: { runs: 0 } },
        ],
        teams: {
          away: { runs: 1, hits: 4, errors: 0 },
          home: { runs: 2, hits: 5, errors: 1 },
        },
      },
    },
  };

  const result = extractInningLinescoreFromFeed(feed);

  assert.deepEqual(result.inningLinescore, [
    { n: 1, away: 0, home: 2 },
    { n: 2, away: 1, home: 0 },
  ]);
  assert.deepEqual(result.inningLinescoreTotals, {
    away: { runs: 1, hits: 4, errors: 0 },
    home: { runs: 2, hits: 5, errors: 1 },
  });
  assert.equal(result.inningLinescoreSig, "1:0-2|2:1-0#A1-4-0#H2-5-1");
});

test("extractInningLinescoreFromFeed returns empty rows when feed has no innings", () => {
  const result = extractInningLinescoreFromFeed({});
  assert.deepEqual(result.inningLinescore, []);
  assert.equal(result.inningLinescoreSig, "#Ax-x-x#Hx-x-x");
});
