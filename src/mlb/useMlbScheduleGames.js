import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { mlbScheduleGameDocPath } from "@src/mlb/mlbScheduleClient";

function targetKey(gameYmd, gameId) {
  const id = String(gameId || "").trim();
  const ymd = String(gameYmd || "").trim();
  if (!id || !ymd) return null;
  return `${ymd}|${id}`;
}

export default function useMlbScheduleGames(targets = []) {
  const [byKey, setByKey] = useState({});

  const pathByKey = useMemo(() => {
    const map = new Map();

    (targets || []).forEach((target) => {
      const key = targetKey(target?.gameYmd, target?.gameId);
      const path = mlbScheduleGameDocPath(target?.gameYmd, target?.gameId);
      if (!key || !path) return;
      map.set(key, path);
    });

    return map;
  }, [
    (targets || [])
      .map((target) => targetKey(target?.gameYmd, target?.gameId))
      .filter(Boolean)
      .sort()
      .join("|"),
  ]);

  useEffect(() => {
    if (!pathByKey.size) {
      setByKey({});
      return undefined;
    }

    const unsubs = [];

    pathByKey.forEach((path, key) => {
      const unsub = firestore()
        .doc(path)
        .onSnapshot(
          (snap) => {
            const data = snap?.exists ? snap.data() || {} : null;
            setByKey((prev) => ({
              ...prev,
              [key]: data
                ? {
                    status: data.status || {},
                    inningState: data.inningState,
                    currentInning: data.currentInning,
                    currentInningOrdinal: data.currentInningOrdinal,
                    awayTeam: data.awayTeam,
                    homeTeam: data.homeTeam,
                    gamePk: data.gamePk,
                  }
                : null,
            }));
          },
          () => {
            setByKey((prev) => ({ ...prev, [key]: null }));
          }
        );

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
    };
  }, [pathByKey]);

  return useMemo(() => {
    const out = {};

    (targets || []).forEach((target) => {
      const gameId = String(target?.gameId || "").trim();
      const key = targetKey(target?.gameYmd, gameId);
      if (!gameId || !key) return;
      out[gameId] = byKey[key] || null;
    });

    return out;
  }, [byKey, targets]);
}
