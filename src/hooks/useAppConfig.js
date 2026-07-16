import { useEffect, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import firestore from "@react-native-firebase/firestore";

export default function useAppConfig() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const ref = firestore().doc("app_config/currentSeason");
    const unsub = ref.onSnapshot(
      (snap) => {
        setConfig(snapshotExists(snap) ? snapshotData(snap) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub?.();
  }, []);

  return { loading, config };
}