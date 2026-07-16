import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";
import { mlbScheduleGameDocPath } from "@src/mlb/mlbScheduleClient";

function scheduleKey(ch) {
  const gameId = String(ch?.gameId || ch?.gamePk || "").trim();
  const gameYmd = String(ch?.gameYmd || "").trim();
  if (!gameId || !gameYmd) return null;
  return `${gameYmd}|${gameId}`;
}

export default function useFgcGameSchedules(challenges = []) {
  const [byKey, setByKey] = useState({});

  const mlbTargets = useMemo(() => {
    const map = new Map();

    (challenges || []).forEach((ch) => {
      if (String(ch?.league || "").toUpperCase() !== "MLB") return;

      const key = scheduleKey(ch);
      const path = mlbScheduleGameDocPath(ch?.gameYmd, ch?.gameId || ch?.gamePk);
      if (!key || !path) return;

      map.set(key, path);
    });

    return map;
  }, [
    (challenges || [])
      .map((ch) => scheduleKey(ch))
      .filter(Boolean)
      .sort()
      .join("|"),
  ]);

  useEffect(() => {
    if (!mlbTargets.size) {
      setByKey({});
      return undefined;
    }

    const unsubs = [];

    mlbTargets.forEach((path, key) => {
      const unsub = firestore()
        .doc(path)
        .onSnapshot(
          (snap) => {
            const data = snapshotExists(snap) ? snapshotData(snap) || {} : null;
            setByKey((prev) => ({
              ...prev,
              [key]: data
                ? {
                    status: data.status || {},
                    startTimeUTC: data.startTimeUTC || null,
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
  }, [mlbTargets]);

  return useMemo(() => {
    const out = {};

    (challenges || []).forEach((ch) => {
      const key = scheduleKey(ch);
      if (!key) return;
      out[String(ch.id || "")] = byKey[key] || null;
    });

    return out;
  }, [byKey, challenges]);
}
