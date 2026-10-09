import {
  aggregateTsPlaysFromWinsByType,
  resolveTsLeaderboardStats,
} from "./tsLeaderboardStats";
import { fgcDisplayPoints } from "./leaderboardDashboardHelpers";
import normalizeMemberRow from "./normalizeMemberRow";

describe("resolveTsLeaderboardStats", () => {
  it("prefers winsByType nhlPointsTotal over inflated payout in tsPoints", () => {
    const row = {
      families: { ts: { points: 27, wins: 1, plays: 2 } },
      tsPoints: 27,
      winsByType: {
        3: { pointsTotal: 27, nhlPointsTotal: 9, wins: 1, plays: 2 },
      },
    };
    expect(resolveTsLeaderboardStats(row)).toEqual({
      points: 9,
      wins: 1,
      plays: 2,
    });
  });
});

describe("normalizeMemberRow", () => {
  it("total = fgc + tp + ts + bonus, not stale pointsTotal", () => {
    const row = normalizeMemberRow({
      pointsTotal: 32,
      fgcPoints: 5,
      tpPoints: 0,
      families: { ts: { points: 9 } },
      dailyBonusPoints: 0,
    });
    expect(row.tsPoints).toBe(9);
    expect(row.pointsTotal).toBe(14);
  });
});

describe("aggregateTsPlaysFromWinsByType", () => {
  it("ignores FGC key", () => {
    expect(
      aggregateTsPlaysFromWinsByType({
        FGC: { pointsTotal: 99, wins: 9, plays: 9 },
        3: { pointsTotal: 5, wins: 1, plays: 1 },
      })
    ).toEqual({ wins: 1, plays: 1 });
  });
});

describe("fgcDisplayPoints", () => {
  it("uses stored fgcPoints", () => {
    expect(fgcDisplayPoints({ fgcPoints: 5, fgcWins: 4 })).toBe(5);
  });
});
