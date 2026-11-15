import { useEffect, useMemo, useState } from "react";
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import {
  deriveMlbCompetitionEntries,
  deriveNhlCompetitionEntries,
  normalizeCompetitionEntry,
  normalizeSport,
  sortCompetitionEntries,
  filterLeaderboardCompetitionEntries,
  nhl20262027CompetitionsFallback,
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

export default function useSportCompetitions({
  sport = "NHL",
  seasonId = "",
  enabled = true,
} = {}) {
  const [catalog, setCatalog] = useState([]);
  const [nhlConfig, setNhlConfig] = useState(null);
  const [loading, setLoading] = useState(!!enabled);

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
    const sportNorm = normalizeSport(sport);
    const sid = String(seasonId || "").trim();
    const todayYmd = getProphetikBusinessYmd();

    let entries = catalog.filter((e) => e.sport === sportNorm);
    entries = filterLeaderboardCompetitionEntries(entries);

    if (!entries.length && sportNorm === "nhl") {
      const cfgSid = String(nhlConfig?.seasonId || "").trim();
      const cfgKey = String(nhlConfig?.competitionKey || "");
      if (cfgSid === "20262027" || cfgKey.startsWith("nhl_20262027_")) {
        entries = nhl20262027CompetitionsFallback();
      }
    }

    if (!entries.length) {
      entries = filterLeaderboardCompetitionEntries(
        deriveFallbackEntries(sport, nhlConfig, todayYmd).filter((e) => e.sport === sportNorm)
      );
    }

    if (sid) {
      const forSeason = entries.filter((e) => String(e.seasonId || "") === sid);
      if (forSeason.length) {
        entries = forSeason;
      } else {
        const latestSeasonId = entries
          .map((e) => String(e.seasonId || ""))
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a))[0];
        if (latestSeasonId) {
          entries = entries.filter((e) => String(e.seasonId || "") === latestSeasonId);
        }
      }
    }

    entries = sortCompetitionEntries(entries);

    return {
      loading,
      competitions: entries,
    };
  }, [catalog, nhlConfig, sport, seasonId, loading]);
}
