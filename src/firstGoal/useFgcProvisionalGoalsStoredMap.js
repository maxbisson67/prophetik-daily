import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { snapshotExists } from "@src/lib/safeSnapshot";
import {
  getFgcMutualizedGameDocId,
  getFgcProvisionalCandidateGoalId,
} from "@src/firstGoal/fgcMutualizedGameUtils";

function buildWatchList(challenges = [], mutualizedGamesByGameId = {}) {
  const rows = [];
  const seen = new Set();

  for (const ch of challenges || []) {
    const gameId = getFgcMutualizedGameDocId(ch);
    if (!gameId) continue;

    const mutualized = mutualizedGamesByGameId[gameId];
    const goalId = getFgcProvisionalCandidateGoalId(mutualized);
    if (!goalId) continue;

    const key = `${gameId}:${goalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, gameId, goalId });
  }

  return rows;
}

/** Map `${gameId}:${goalId}` -> boolean (but encore présent dans nhl_live_games/.../goals). */
export default function useFgcProvisionalGoalsStoredMap(challenges = [], mutualizedGamesByGameId = {}) {
  const [storedByKey, setStoredByKey] = useState({});

  const watchList = buildWatchList(challenges, mutualizedGamesByGameId);
  const watchSig = watchList.map((r) => r.key).join("|");

  useEffect(() => {
    if (!watchList.length) {
      setStoredByKey({});
      return;
    }

    const unsubs = watchList.map(({ key, gameId, goalId }) =>
      firestore()
        .collection("nhl_live_games")
        .doc(gameId)
        .collection("goals")
        .doc(goalId)
        .onSnapshot(
          (snap) => {
            setStoredByKey((prev) => ({
              ...prev,
              [key]: snapshotExists(snap),
            }));
          },
          () => {
            setStoredByKey((prev) => ({
              ...prev,
              [key]: false,
            }));
          }
        )
    );

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
    };
  }, [watchSig]);

  return storedByKey;
}

export function isFgcProvisionalGoalStillStored(storedByKey, gameId, goalId) {
  if (!gameId || !goalId) return true;
  const key = `${gameId}:${goalId}`;
  if (!(key in storedByKey)) return true;
  return storedByKey[key] !== false;
}
