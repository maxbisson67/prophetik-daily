import { useEffect, useMemo, useState } from "react";
import {
  enumerateYmdRange,
  evaluatedGameYmd,
  last7GameYmds,
  loadDailyChallengeParticipantUids,
  loadParticipatingMemberUids,
} from "./groupDailyParticipationUtils";
import { addDaysToYmd } from "@src/lib/prophetikBusinessDate";

function pct(rate) {
  if (rate == null || Number.isNaN(rate)) return null;
  return Math.round(rate * 1000) / 10;
}

function memberRate(daysPlayed, challengeDayCount) {
  if (!challengeDayCount) return null;
  return daysPlayed / challengeDayCount;
}

async function aggregateParticipationForYmds(
  groupId,
  ymds,
  participatingSet,
  participatingMemberCount
) {
  const uidPlayDays = new Map();
  let challengeDayCount = 0;
  let lastDay = null;
  const dailyGroupRates = [];

  for (const ymd of ymds) {
    const day = await loadDailyChallengeParticipantUids(groupId, ymd);
    if (!day.hadChallenges) continue;

    challengeDayCount += 1;
    let dailyParticipants = 0;

    day.uids.forEach((uid) => {
      if (!participatingSet.has(uid)) return;
      dailyParticipants += 1;
      uidPlayDays.set(uid, (uidPlayDays.get(uid) || 0) + 1);
    });

    if (participatingMemberCount > 0) {
      dailyGroupRates.push(dailyParticipants / participatingMemberCount);
    }

    lastDay = { ymd, dailyParticipants, challengeCount: day.challengeCount };
  }

  const avgGroupRate =
    dailyGroupRates.length > 0
      ? dailyGroupRates.reduce((s, r) => s + r, 0) / dailyGroupRates.length
      : null;

  return { uidPlayDays, challengeDayCount, lastDay, avgGroupRate };
}

export default function useGroupDailyParticipation(
  groupId,
  { enabled = true, competitionFromYmd = null, competitionToYmd = null } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const latestYmd = useMemo(() => evaluatedGameYmd(), []);

  const totalFromYmd = useMemo(() => {
    const from = String(competitionFromYmd || "").slice(0, 10);
    if (from) return from;
    return addDaysToYmd(latestYmd, -89);
  }, [competitionFromYmd, latestYmd]);

  const totalToYmd = useMemo(() => {
    const compTo = String(competitionToYmd || "").slice(0, 10);
    if (compTo && compTo < latestYmd) return compTo;
    return latestYmd;
  }, [competitionToYmd, latestYmd]);

  useEffect(() => {
    let alive = true;

    if (!enabled || !groupId) {
      setSnapshot(null);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const membership = await loadParticipatingMemberUids(groupId);
        const participatingSet = new Set(membership.participatingUids);
        const ymds7 = last7GameYmds(latestYmd);
        const ymdsTotal = enumerateYmdRange(totalFromYmd, totalToYmd);

        const [stats7, statsTotal] = await Promise.all([
          aggregateParticipationForYmds(
            groupId,
            ymds7,
            participatingSet,
            membership.participatingMembers
          ),
          aggregateParticipationForYmds(
            groupId,
            ymdsTotal,
            participatingSet,
            membership.participatingMembers
          ),
        ]);

        const avg7 = stats7.avgGroupRate;
        const lastDay7 = stats7.lastDay;
        const lastDayRate =
          lastDay7 && membership.participatingMembers > 0
            ? lastDay7.dailyParticipants / membership.participatingMembers
            : null;

        const displayUids =
          membership.displayUids?.length > 0
            ? membership.displayUids
            : membership.participatingUids;

        const participantRows = displayUids
          .map((uid) => {
            const eligible = participatingSet.has(uid);
            const days7 = stats7.uidPlayDays.get(uid) || 0;
            const daysTotal = statsTotal.uidPlayDays.get(uid) || 0;
            return {
              uid,
              eligibleForDefis: eligible,
              rate7: eligible
                ? memberRate(days7, stats7.challengeDayCount)
                : null,
              rateTotal: eligible
                ? memberRate(daysTotal, statsTotal.challengeDayCount)
                : null,
              daysPlayed7: days7,
              daysPlayedTotal: daysTotal,
              challengeDayCount7: stats7.challengeDayCount,
              challengeDayCountTotal: statsTotal.challengeDayCount,
            };
          })
          .sort((a, b) => {
            if (a.eligibleForDefis !== b.eligibleForDefis) {
              return a.eligibleForDefis ? -1 : 1;
            }
            return (b.rateTotal || 0) - (a.rateTotal || 0);
          });

        if (!alive) return;

        setSnapshot({
          latestYmd,
          totalFromYmd,
          totalToYmd,
          activeMembers: membership.activeMembers,
          participatingMembers: membership.participatingMembers,
          lastDayRate,
          lastDayYmd: lastDay7?.ymd ?? null,
          lastDayParticipants: lastDay7?.dailyParticipants ?? 0,
          avg7Rate: avg7,
          challengeDayCount7: stats7.challengeDayCount,
          challengeDayCountTotal: statsTotal.challengeDayCount,
          participantRows,
        });
      } catch (e) {
        if (!alive) return;
        setError(e);
        setSnapshot(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [groupId, enabled, latestYmd, totalFromYmd, totalToYmd]);

  return {
    loading,
    error,
    latestYmd,
    totalFromYmd,
    totalToYmd,
    ...(snapshot || {}),
    lastDayRatePct: pct(snapshot?.lastDayRate),
    avg7RatePct: pct(snapshot?.avg7Rate),
  };
}
