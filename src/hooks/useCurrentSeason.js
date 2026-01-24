// src/hooks/useCurrentSeason.js
import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

// ✅ Choisis UN chemin stable (recommandé)
const CURRENT_SEASON_DOC = "app_config/currentSeason";

// ✅ Fallback MVP si le doc n'existe pas encore
const FALLBACK = {
  seasonId: "20252026",
  fromYmd: "2025-10-01",
  toYmd: "2026-06-30",
};

export default function useCurrentSeason() {
  const [season, setSeason] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ref = firestore().doc(CURRENT_SEASON_DOC);


    const unsub = ref.onSnapshot(
      (snap) => {
        if (!snap.exists) {
          setSeason(FALLBACK);
          setLoading(false);
          return;
        }

        const d = snap.data() || {};
        const seasonId = String(d.seasonId || FALLBACK.seasonId);
        const fromYmd = String(d.fromYmd || FALLBACK.fromYmd).slice(0, 10);
        const toYmd = String(d.toYmd || FALLBACK.toYmd).slice(0, 10);

        setSeason({ seasonId, fromYmd, toYmd });
        setLoading(false);
      },
      (e) => {
        setError(e);
        setSeason(FALLBACK);
        setLoading(false);
      }
    );

    return () => unsub?.();
  }, []);

  const safe = useMemo(() => {
    const seasonId = String(season?.seasonId || FALLBACK.seasonId);
    const fromYmd = String(season?.fromYmd || FALLBACK.fromYmd).slice(0, 10);
    const toYmd = String(season?.toYmd || FALLBACK.toYmd).slice(0, 10);
    return { seasonId, fromYmd, toYmd };
  }, [season]);

  return { season: safe, loading, error };
}