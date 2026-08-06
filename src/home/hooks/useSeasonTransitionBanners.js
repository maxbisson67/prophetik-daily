import { useMemo } from "react";
import useActiveCompetition from "@src/hooks/useActiveCompetition";
import { useLeaderboardCompetitionMeta } from "@src/hooks/useGroupCompetitionHistory";
import useLeaderboardProfiles, { resolveLeaderboardMember } from "@src/leaderboard/useLeaderboardProfiles";
import { getProphetikBusinessYmd } from "@src/lib/prophetikBusinessDate";
import {
  buildCompetitionKey,
  isWithinCompetitionWindow,
  normalizeSport,
} from "@src/season/seasonCompetitionCore";

function formatWinnerNames(winnerUids = [], profiles = {}) {
  const names = winnerUids
    .map((uid) => resolveLeaderboardMember({ uid }, profiles).displayName)
    .filter(Boolean);

  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

export default function useSeasonTransitionBanners({ sport = "MLB", groupId, enabled = true } = {}) {
  const sportNorm = normalizeSport(sport);
  const hookEnabled = enabled && !!groupId;

  const {
    phase,
    seasonId,
    label: activeLabel,
    fromYmd,
    toYmd,
    loading: loadingActive,
  } = useActiveCompetition({ sport, enabled: hookEnabled });

  const regularCompetitionKey = useMemo(() => {
    if (!seasonId) return "";
    return buildCompetitionKey(sportNorm, seasonId, "regular");
  }, [sportNorm, seasonId]);

  const { meta: regularMeta, loading: loadingRegularMeta } = useLeaderboardCompetitionMeta({
    groupId,
    competitionKey: regularCompetitionKey,
    enabled: hookEnabled && !!regularCompetitionKey,
  });

  const winnerUids = useMemo(
    () => (Array.isArray(regularMeta?.winnerUids) ? regularMeta.winnerUids.map(String).filter(Boolean) : []),
    [regularMeta?.winnerUids]
  );

  const profiles = useLeaderboardProfiles(winnerUids);

  return useMemo(() => {
    if (!hookEnabled) {
      return {
        loading: false,
        championBanner: null,
        playoffsBanner: null,
      };
    }

    const loading = loadingActive || loadingRegularMeta;
    const todayYmd = getProphetikBusinessYmd();
    const playoffsLive =
      phase === "playoffs" &&
      isWithinCompetitionWindow({ fromYmd, toYmd }, todayYmd);

    const regularFinalized =
      String(regularMeta?.status || "").toLowerCase() === "finalized" || !!regularMeta?.winnerDeclaredAt;

    const championBanner =
      playoffsLive && regularFinalized && winnerUids.length
        ? {
            winnerNames: formatWinnerNames(winnerUids, profiles),
            winnerUids,
            winnerPoints: Number(regularMeta?.winnerPoints ?? 0) || 0,
            seasonId,
            sport: sportNorm,
          }
        : null;

    const playoffsBanner = playoffsLive
      ? {
          label: activeLabel,
          seasonId,
          sport: sportNorm,
        }
      : null;

    return {
      loading,
      championBanner,
      playoffsBanner,
    };
  }, [
    hookEnabled,
    loadingActive,
    loadingRegularMeta,
    regularMeta,
    winnerUids,
    profiles,
    phase,
    fromYmd,
    toYmd,
    seasonId,
    sportNorm,
    activeLabel,
  ]);
}
