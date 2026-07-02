import { useEffect, useMemo, useState } from "react";
import firestore from "@react-native-firebase/firestore";

const CURRENT_SEASON_DOC = "app_config/currentSeason";
const CACHE_TTL_MS = 15 * 60 * 1000;

const FALLBACK = {
  seasonId: "20252026",
  fromYmd: "2025-10-01",
  toYmd: "2026-06-30",
};

let cachedSeason = null;
let cachedAt = 0;
let inflight = null;

async function fetchCurrentSeasonOnce() {
  if (cachedSeason && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSeason;
  }

  if (inflight) return inflight;

  inflight = firestore()
    .doc(CURRENT_SEASON_DOC)
    .get()
    .then((snap) => {
      if (!snap.exists) {
        cachedSeason = FALLBACK;
      } else {
        const d = snap.data() || {};
        cachedSeason = {
          seasonId: String(d.seasonId || FALLBACK.seasonId),
          fromYmd: String(d.fromYmd || FALLBACK.fromYmd).slice(0, 10),
          toYmd: String(d.toYmd || FALLBACK.toYmd).slice(0, 10),
        };
      }
      cachedAt = Date.now();
      inflight = null;
      return cachedSeason;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });

  return inflight;
}

export default function useCurrentSeason() {
  const [season, setSeason] = useState(cachedSeason || FALLBACK);
  const [loading, setLoading] = useState(!cachedSeason);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    fetchCurrentSeasonOnce()
      .then((next) => {
        if (mounted) {
          setSeason(next);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e);
          setSeason(FALLBACK);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const safe = useMemo(() => {
    const seasonId = String(season?.seasonId || FALLBACK.seasonId);
    const fromYmd = String(season?.fromYmd || FALLBACK.fromYmd).slice(0, 10);
    const toYmd = String(season?.toYmd || FALLBACK.toYmd).slice(0, 10);
    return { seasonId, fromYmd, toYmd };
  }, [season]);

  return { season: safe, loading, error };
}
