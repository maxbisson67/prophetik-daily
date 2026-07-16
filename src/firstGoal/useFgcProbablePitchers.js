import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import { mlbScheduleGameDocPath } from "@src/mlb/mlbScheduleClient";
import { normalizeMlbPitcherId } from "@src/mlb/loadMlbBvpForPlayers";
import { mergeProbablePitcherRecords } from "@src/mlb/fgcBvpUtils";

function hasPitcherId(pitcher) {
  return !!normalizeMlbPitcherId(pitcher);
}

export default function useFgcProbablePitchers(challenge) {
  const league = String(challenge?.league || "NHL").toUpperCase();
  const isMlb = league === "MLB";
  const gameId = String(challenge?.gameId || challenge?.gamePk || "");
  const schedulePath = isMlb ? mlbScheduleGameDocPath(challenge?.gameYmd, gameId) : null;

  const [schedulePitchers, setSchedulePitchers] = useState(null);

  const needsSchedulePitchers =
    isMlb &&
    schedulePath &&
    (!hasPitcherId(challenge?.awayProbablePitcher) ||
      !hasPitcherId(challenge?.homeProbablePitcher) ||
      !String(challenge?.awayProbablePitcher?.name || "").trim() ||
      !String(challenge?.homeProbablePitcher?.name || "").trim());

  useEffect(() => {
    if (!needsSchedulePitchers || !schedulePath) {
      setSchedulePitchers(null);
      return undefined;
    }

    const unsub = firestore()
      .doc(schedulePath)
      .onSnapshot(
        (snap) => {
          if (!snapshotExists(snap)) {
            setSchedulePitchers(null);
            return;
          }
          const data = snapshotData(snap) || {};
          setSchedulePitchers({
            away: data.awayProbablePitcher || null,
            home: data.homeProbablePitcher || null,
          });
        },
        () => {
          setSchedulePitchers(null);
        }
      );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [needsSchedulePitchers, schedulePath]);

  return useMemo(
    () => ({
      away: mergeProbablePitcherRecords(challenge?.awayProbablePitcher, schedulePitchers?.away),
      home: mergeProbablePitcherRecords(challenge?.homeProbablePitcher, schedulePitchers?.home),
    }),
    [challenge?.awayProbablePitcher, challenge?.homeProbablePitcher, schedulePitchers]
  );
}
