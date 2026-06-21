import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { mlbScheduleGameDocPath } from "@src/mlb/mlbScheduleClient";

export default function useFgcProbablePitchers(challenge) {
  const league = String(challenge?.league || "NHL").toUpperCase();
  const isMlb = league === "MLB";
  const gameId = String(challenge?.gameId || challenge?.gamePk || "");
  const schedulePath = isMlb ? mlbScheduleGameDocPath(challenge?.gameYmd, gameId) : null;

  const [schedulePitchers, setSchedulePitchers] = useState(null);

  const challengeHasPitcherNames =
    !!challenge?.awayProbablePitcher?.name || !!challenge?.homeProbablePitcher?.name;

  useEffect(() => {
    if (!isMlb || challengeHasPitcherNames) {
      setSchedulePitchers(null);
      return undefined;
    }

    if (!schedulePath) {
      setSchedulePitchers(null);
      return undefined;
    }

    let cancelled = false;

    firestore()
      .doc(schedulePath)
      .get()
      .then((snap) => {
        if (cancelled || !snap.exists) return;
        const data = snap.data() || {};
        setSchedulePitchers({
          away: data.awayProbablePitcher || null,
          home: data.homeProbablePitcher || null,
        });
      })
      .catch(() => {
        if (!cancelled) setSchedulePitchers(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isMlb, challengeHasPitcherNames, schedulePath]);

  return useMemo(() => {
    const away =
      (challenge?.awayProbablePitcher?.name ? challenge.awayProbablePitcher : null) ||
      schedulePitchers?.away ||
      challenge?.awayProbablePitcher ||
      null;
    const home =
      (challenge?.homeProbablePitcher?.name ? challenge.homeProbablePitcher : null) ||
      schedulePitchers?.home ||
      challenge?.homeProbablePitcher ||
      null;

    return { away, home };
  }, [
    challenge?.awayProbablePitcher,
    challenge?.homeProbablePitcher,
    schedulePitchers,
  ]);
}
