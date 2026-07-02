import { useEffect, useMemo, useState } from "react";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import {
  deriveMlbCompetitionEntries,
  deriveNhlCompetitionEntries,
  normalizeCompetitionEntry,
  normalizeSport,
  sortCompetitionEntries,
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

    const unCatalog = seasonCompetitionCollection().onSnapshot(
      (snap) => {
        const rows = snap.docs
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
      (snap) => setNhlConfig(snap.exists ? snap.data() || {} : null),
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
    const sid = String(seasonId || "").trim();
    const todayYmd = getProphetikBusinessYmd();

    let entries = catalog.filter((e) => e.sport === sportNorm);
    if (!entries.length) {
      entries = deriveFallbackEntries(sport, nhlConfig, todayYmd).filter(
        (e) => e.sport === sportNorm
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
