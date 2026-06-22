import { isMlbGamePostponed } from "@src/mlb/mlbGameStatusUtils";

export { isMlbGamePostponed };

export function isFgcChallengeParticipationOpen({
  challengeStatus,
  scheduleStatus,
  hasMyPick,
  deadlinePassed,
}) {
  const st = String(challengeStatus || "").toLowerCase();
  const postponed = isMlbGamePostponed(scheduleStatus);

  if (postponed) {
    return {
      canParticipate: true,
      canEdit: hasMyPick,
      showPostponed: true,
      ignoreDeadline: true,
    };
  }

  const open = st === "open" && !deadlinePassed;

  return {
    canParticipate: open && !hasMyPick,
    canEdit: open && hasMyPick,
    showPostponed: false,
    ignoreDeadline: false,
  };
}
