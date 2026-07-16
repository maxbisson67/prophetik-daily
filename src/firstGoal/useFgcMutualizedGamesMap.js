import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import { getFgcMutualizedGameCollection } from "@src/firstGoal/fgcMutualizedGameUtils";
import { getFgcLeague } from "@src/firstGoal/fgcChallengeUtils";

function buildGameRequests(challenges = []) {
  const byKey = new Map();

  for (const ch of challenges || []) {
    const gameId = String(ch?.gamePk || ch?.gameId || "").trim();
    if (!gameId) continue;

    const league = getFgcLeague(ch);
    const collection = getFgcMutualizedGameCollection(ch);
    const key = `${collection}/${gameId}`;

    if (!byKey.has(key)) {
      byKey.set(key, { collection, gameId });
    }
  }

  return [...byKey.values()];
}

/** Map gameId -> doc mutualisé pour une liste de défis FGC. */
export default function useFgcMutualizedGamesMap(challenges = [], { enabled = true } = {}) {
  const [byGameId, setByGameId] = useState({});
  const requests = useMemo(() => buildGameRequests(challenges), [challenges]);

  useEffect(() => {
    if (!enabled || !requests.length) {
      setByGameId({});
      return;
    }

    const unsubs = requests.map(({ collection, gameId }) =>
      firestore()
        .collection(collection)
        .doc(gameId)
        .onSnapshot(
          (snap) => {
            setByGameId((prev) => ({
              ...prev,
              [gameId]: snapshotExists(snap) ? snapshotData(snap) || null : null,
            }));
          },
          () => {
            setByGameId((prev) => ({
              ...prev,
              [gameId]: null,
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
  }, [enabled, requests.map((r) => `${r.collection}/${r.gameId}`).join("|")]);

  return byGameId;
}
