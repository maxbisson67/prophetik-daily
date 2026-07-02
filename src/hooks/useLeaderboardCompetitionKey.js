import { useMemo } from "react";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import {
  competitionKeyMatchesSport,
  pickDefaultLeaderboardCompetition,
} from "@src/season/seasonCompetitionCore";
import useActiveCompetition from "@src/hooks/useActiveCompetition";
import useSportCompetitions from "@src/hooks/useSportCompetitions";

/**
 * Clé de compétition utilisée pour lire le classement (points / rang).
 * Peut différer de la compétition "active du jour" en hors-saison (ex. NHL → régulière).
 */
export default function useLeaderboardCompetitionKey({
  sport = "NHL",
  enabled = true,
} = {}) {
  const todayYmd = useMemo(() => getProphetikBusinessYmd(), []);

  const {
    competitionKey: activeCompetitionKey,
    seasonId: activeSeasonId,
    daysRemaining,
    label: competitionLabel,
    loading: loadingActive,
  } = useActiveCompetition({ sport, enabled });

  const seasonIdForCatalog = useMemo(() => {
    if (!activeSeasonId || !activeCompetitionKey) return "";
    return competitionKeyMatchesSport(activeCompetitionKey, sport) ? activeSeasonId : "";
  }, [activeSeasonId, activeCompetitionKey, sport]);

  const { competitions, loading: loadingCatalog } = useSportCompetitions({
    sport,
    seasonId: seasonIdForCatalog,
    enabled,
  });

  const competitionKey = useMemo(() => {
    const preferred =
      activeCompetitionKey && competitionKeyMatchesSport(activeCompetitionKey, sport)
        ? activeCompetitionKey
        : "";

    const picked = pickDefaultLeaderboardCompetition(competitions, todayYmd, preferred);
    if (picked?.competitionKey) return picked.competitionKey;

    return preferred;
  }, [competitions, activeCompetitionKey, sport, todayYmd]);

  return {
    competitionKey,
    daysRemaining,
    competitionLabel,
    loading: loadingActive || loadingCatalog,
  };
}
