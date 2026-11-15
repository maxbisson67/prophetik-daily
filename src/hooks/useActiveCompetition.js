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
  competitionTimelineStatus,
  filterLeaderboardCompetitionEntries,
  pickDefaultLeaderboardCompetition,
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

function emptyActiveCompetition(loading = false) {
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
    timelineStatus: "",
  };
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

    const failSafe = setTimeout(() => setLoading(false), 6000);

    seasonCompetitionCollection()
      .get()
      .then((snap) => {
        const rows = (snap?.docs ?? [])
          .map((d) => normalizeCompetitionEntry(d.data(), d.id))
          .filter(Boolean);
        setCatalog(rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const unCatalog = seasonCompetitionCollection().onSnapshot(
        (snap) => {
          try {
            const rows = (snap?.docs ?? [])
              .map((d) => normalizeCompetitionEntry(d.data(), d.id))
              .filter(Boolean);
            setCatalog(rows);
          } catch {
            setCatalog([]);
          } finally {
            setLoading(false);
          }
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
      clearTimeout(failSafe);
      try {
        unCatalog?.();
      } catch {}
      try {
        unSeason?.();
      } catch {}
    };
  }, [enabled]);

  return useMemo(() => {
    if (!enabled) {
      return emptyActiveCompetition(false);
    }

    const sportNorm = normalizeSport(sport);
    const sportCatalog = filterLeaderboardCompetitionEntries(
      catalog.filter((e) => e.sport === sportNorm)
    );
    let active = pickCompetitionForDate(sportCatalog, todayYmd);

    if (!active && !sportCatalog.length) {
      const fallback = filterLeaderboardCompetitionEntries(
        deriveFallbackEntries(sport, nhlConfig, todayYmd).filter((e) => e.sport === sportNorm)
      );
      active = pickCompetitionForDate(fallback, todayYmd);
    }

    if (!active && sportCatalog.length) {
      active =
        pickDefaultLeaderboardCompetition(sportCatalog, todayYmd, "") || sportCatalog[0] || null;
    }

    if (!active) {
      return { ...emptyActiveCompetition(false), loading: loading && !catalog.length };
    }

    const daysRemaining = daysRemainingUntil(active.toYmd, todayYmd);
    const timelineStatus = competitionTimelineStatus(active, todayYmd);

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
      timelineStatus,
    };
  }, [catalog, nhlConfig, sport, todayYmd, loading, enabled]);
}
