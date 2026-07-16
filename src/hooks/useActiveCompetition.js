import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import {
  deriveMlbCompetitionEntries,
  deriveNhlCompetitionEntries,
  daysRemainingUntil,
  normalizeCompetitionEntry,
  normalizeSport,
  pickCompetitionForDate,
} from "@src/season/seasonCompetitionCore";
import {
  currentSeasonDocRef,
  seasonCompetitionCollection,
} from "@src/season/seasonCompetitionPaths";

function deriveFallbackEntries(sport, nhlConfig, gameYmd) {
  const s = normalizeSport(sport);
  if (s === "nhl") {
    return deriveNhlCompetitionEntries(nhlConfig || {});
  }
  const year = String(gameYmd || getProphetikBusinessYmd()).slice(0, 4);
  return deriveMlbCompetitionEntries(year);
}

export default function useActiveCompetition({ sport = "NHL", gameYmd, enabled = true } = {}) {
  const [catalog, setCatalog] = useState([]);
  const [nhlConfig, setNhlConfig] = useState(null);
  const [loading, setLoading] = useState(!!enabled);

  const todayYmd = useMemo(() => {
    return String(gameYmd || getProphetikBusinessYmd()).slice(0, 10);
  }, [gameYmd]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unCatalog = seasonCompetitionCollection().onSnapshot(
        (snap) => {
          const rows = (snap?.docs ?? [])
            .map((d) => normalizeCompetitionEntry(d.data(), d.id))
            .filter(Boolean);
          setCatalog(rows);
          setLoading(false);
        },
        () => {
          setCatalog([]);
          setLoading(false);
        }
      );

    const unSeason = currentSeasonDocRef().onSnapshot(
        (snap) => setNhlConfig(snapshotExists(snap) ? snapshotData(snap) || {} : null),
        () => setNhlConfig(null)
      );

    return () => {
      try {
        unCatalog?.();
      } catch {}
      try {
        unSeason?.();
      } catch {}
    };
  }, [enabled]);

  return useMemo(() => {
    const sportNorm = normalizeSport(sport);
    const sportCatalog = catalog.filter(
      (e) => e.sport === sportNorm && String(e.status || "").toLowerCase() !== "finalized"
    );
    let active = pickCompetitionForDate(sportCatalog, todayYmd);

    if (!active) {
      const fallback = deriveFallbackEntries(sport, nhlConfig, todayYmd).filter(
        (e) => String(e.status || "").toLowerCase() !== "finalized"
      );
      active = pickCompetitionForDate(fallback, todayYmd);
    }

    if (!active) {
      return {
        loading,
        competition: null,
        competitionKey: "",
        seasonId: "",
        phase: "",
        label: "",
        fromYmd: "",
        toYmd: "",
        daysRemaining: null,
      };
    }

    const daysRemaining = daysRemainingUntil(active.toYmd, todayYmd);

    return {
      loading,
      competition: active,
      competitionKey: active.competitionKey,
      seasonId: active.seasonId,
      phase: active.phase,
      label: active.label,
      fromYmd: active.fromYmd,
      toYmd: active.toYmd,
      daysRemaining,
    };
  }, [catalog, nhlConfig, sport, todayYmd, loading]);
}
