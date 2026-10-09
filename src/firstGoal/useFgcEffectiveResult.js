import { useMemo } from "react";
import useFgcMutualizedGame from "@src/firstGoal/useFgcMutualizedGame";
import useFgcProvisionalGoalStored from "@src/firstGoal/useFgcProvisionalGoalStored";
import {
  getFgcProvisionalCandidateGoalId,
  resolveFgcEffectiveResult,
} from "@src/firstGoal/fgcMutualizedGameUtils";

export default function useFgcEffectiveResult(challenge, { enabled = true } = {}) {
  const { data: mutualizedGame, loading: mutualizedLoading } = useFgcMutualizedGame(challenge, {
    enabled,
  });

  const candidateGoalId = getFgcProvisionalCandidateGoalId(mutualizedGame);
  const goalStillStored = useFgcProvisionalGoalStored(challenge, candidateGoalId);

  const effectiveResult = useMemo(
    () =>
      resolveFgcEffectiveResult(challenge, mutualizedGame, {
        provisionalGoalStillStored: goalStillStored !== false,
      }),
    [challenge, mutualizedGame, goalStillStored]
  );

  return {
    effectiveResult,
    mutualizedGame,
    mutualizedLoading,
    candidateGoalId,
    provisionalGoalStillStored: goalStillStored,
  };
}
