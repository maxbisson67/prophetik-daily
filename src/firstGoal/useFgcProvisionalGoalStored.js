import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { snapshotExists } from "@src/lib/safeSnapshot";
import {
  getFgcMutualizedGameCollection,
  getFgcMutualizedGameDocId,
} from "@src/firstGoal/fgcMutualizedGameUtils";

/**
 * true si le doc but existe encore dans Firestore (false = retiré / refusé).
 * null = pas de candidat provisoire à vérifier.
 */
export default function useFgcProvisionalGoalStored(challenge, candidateGoalId) {
  const [stored, setStored] = useState(null);

  const gameId = getFgcMutualizedGameDocId(challenge);
  const goalId = candidateGoalId ? String(candidateGoalId) : "";
  const mutualizedCollection = getFgcMutualizedGameCollection(challenge);

  useEffect(() => {
    if (!gameId || !goalId) {
      setStored(null);
      return;
    }

    if (mutualizedCollection !== "nhl_first_goal_games") {
      setStored(null);
      return;
    }

    const unsub = firestore()
      .collection("nhl_live_games")
      .doc(gameId)
      .collection("goals")
      .doc(goalId)
      .onSnapshot(
        (snap) => setStored(snapshotExists(snap)),
        () => setStored(false)
      );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [gameId, goalId, mutualizedCollection]);

  return stored;
}
