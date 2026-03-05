import { useEffect, useState } from "react";
import firestore from "@react-native-firebase/firestore";

export default function useAppConfig() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const ref = firestore().doc("app_config/currentSeason");
    const unsub = ref.onSnapshot(
      (snap) => {
        setConfig(snap.exists ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub?.();
  }, []);

  return { loading, config };
}