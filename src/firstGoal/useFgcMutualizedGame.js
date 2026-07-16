import { useEffect, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import {
  getFgcMutualizedGameCollection,
  getFgcMutualizedGameDocId,
} from "@src/firstGoal/fgcMutualizedGameUtils";
import { getFgcLeague } from "@src/firstGoal/fgcChallengeUtils";

/** Écoute mlb_first_rbi_games / nhl_first_goal_games pour un défi FGC. */
export default function useFgcMutualizedGame(challenge, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!enabled);

  const gameId = getFgcMutualizedGameDocId(challenge);
  const league = getFgcLeague(challenge);

  useEffect(() => {
    if (!enabled || !gameId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const collection = getFgcMutualizedGameCollection(challenge);

    const unsub = firestore()
      .collection(collection)
      .doc(gameId)
      .onSnapshot(
        (snap) => {
          setData(snapshotExists(snap) ? snapshotData(snap) || null : null);
          setLoading(false);
        },
        (err) => {
          console.log("[useFgcMutualizedGame] error", collection, gameId, err?.message || err);
          setData(null);
          setLoading(false);
        }
      );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [enabled, gameId, league, challenge?.fgcMode, challenge?.gamePk, challenge?.gameId]);

  return { data, loading, gameId, league };
}
