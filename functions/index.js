// functions/index.js

export { notifyOnDefiCreate } from "./notifyOnDefiCreate.js";
export { sendTestPush } from "./sendTestPush.js";

export { onParticipantCreate, freeTopUp } from "./participants.js";

export { purchaseAvatar } from "./purchaseAvatar.js";
export { purchaseGroupAvatar } from "./purchaseGroupAvatar.js";

export { mirrorParticipantToPublic } from "./publicProfileMirror.js";

export { onAvatarIdChange } from "./onAvatarIdChange.js";

export { issueWebCustomToken } from "./issueWebCustomToken.js";

export { refreshNhlPlayers, refreshNhlPlayersCron, nightlyNhlPlayers } from "./players.js";

export { cronIngestToday, cronDefiStatus } from "./statusCron.js";
export { ingestStatsForDate, ingestStatsForDateCron, syncDefiLiveScores } from "./ingest.js";

export { finalizeDefiWinners } from "./finalize.js";
export { ingestSkaterStatsForSeason, cronIngestSkaterStatsDaily } from "./nhlIngest.js";
export { cronIngestNhlDailyContext,cronRefreshNhlScheduleWindow,cronRefreshNhlScheduleRecentScores} from "./nhlContextIngest.js";


export { precheckPhoneLogin } from "./precheckPhoneLogin.js";

export {
  deleteGroup,
  leaveGroup,
  transferGroupOwnership,
  updateGroupConfig,
} from "./groups/groupsManagement.js";
export { sendGroupMessage } from "./groups/sendGroupMessage.js";
export { novaCoach } from "./novaCoach.js";

// Nhl Live
export { updateNhlLiveGamesNow, updateNhlLiveGamesCron} from "./nhlLive.js"

// Mlb Live
export { updateMlbLiveGamesNow, updateMlbLiveGamesCron } from "./mlb/mlbLive.js";
export { voidMlbPostponedChallenges } from "./mlb/voidMlbPostponedChallenges.js";
export { prefetchMlbBvp } from "./mlb/mlbBvpCallable.js";
export { prefetchMlbLineups } from "./mlb/mlbLineupsCallable.js";

export { updateNhlStandingsNow, refreshNhlStandings } from "./nhlStandings.js";

// Credits et dailyShotBonus
export { dailyShotBonus} from "./credits/dailyShotBonus.js"
export { purchaseCredits } from "./credits/purchaseCredits.js";

export { revenuecatWebhook } from "./revenuecat/revenuecatWebhook.js";
export { syncSubscriptionEntitlement } from "./revenuecat/syncSubscriptionEntitlement.js";
export { deleteAccount } from "./account/deleteAccount.js";

export { syncNhlInjuries, syncNhlInjuriesManual } from "./nhlInjuriesSync.js";
export { syncMlbInjuries, syncMlbInjuriesManual } from "./mlb/mlbInjuriesSync.js";

export { backfillParticipantProgression } from "./achievements/backfillParticipantProgression.js";


// Prophetik IA et création de groupe
export { onGroupCreated } from "./groups/onGroupCreated.js";
export { createGroupWithCap } from "./groups/createGroupWithCap.js";
export { joinGroupWithCap } from "./groups/joinGroupWithCap.js";
export { getUserPlanUsageCallable as getUserPlanUsage } from "./subscriptions/getUserPlanUsage.js";
export { resolveAutopilotGroups } from "./groups/resolveAutopilotGroups.js";

// Prophetik IA et création de défi
export { onDefiCreated } from "./defis/onDefiCreated.js";
export { novaPickAtLock } from "./defis/novaPickAtLock.js";
export { defisCreate } from "./defis/defisCreate.js";
export { defisJoin } from "./defis/defisJoin.js";

// Leader board
export { rebuildLeaderboardSeasonForGroup, rebuildAllLeaderboardsSeason } from "./leaderboard/rebuildLeaderboard.js";
export { finalizeSeasonCompetitions } from "./leaderboard/finalizeSeasonCompetitions.js";

// Les Ascensions
export { ascensionsCreate } from "./ascensions/ascensionsCreate.js";
export { ascensionsTick } from "./ascensions/ascensionsTick.js";
export { ascensionsDailyNotification } from "./ascensions/ascensionsDailyNotification.js";
export { ascensionsNotifyOnCreate } from "./ascensions/ascensionsNotifyOnCreate.js";
export { finalizeAscensionCycleWinners } from "./ascensions/finalizeAscensionCycleWinners.js";
export { applyAscensionDailyBonus } from "./ascensions/applyAscensionDailyBonus.js";

//  Team Prediction Challenge (legacy mono-match)
export { createTeamPredictionChallenge } from "./teamPredictionChallenges/createTeamPredictionChallenge.js";
export { submitTeamPredictionEntry } from "./teamPredictionChallenges/submitTeamPredictionEntry.js";
export { resolveTeamPredictionResults } from "./teamPredictionChallenges/resolveTeamPredictionResults.js";
export { applyTeamPredictionPayout } from "./teamPredictionChallenges/applyTeamPredictionPayout.js";

//  Team Prediction Bundle (1 carte / jusqu'à 2 matchs)
export { createTeamPredictionBundle } from "./teamPredictionBundles/createTeamPredictionBundle.js";
export { getTeamPredictionBundleForHome } from "./teamPredictionBundles/getTeamPredictionBundleForHome.js";
export { submitTeamPredictionBundleEntry } from "./teamPredictionBundles/submitTeamPredictionBundleEntry.js";
export { resolveTeamPredictionBundleResults } from "./teamPredictionBundles/resolveTeamPredictionBundleResults.js";
export { resolveTeamPredictionBundleNow } from "./teamPredictionBundles/resolveTeamPredictionBundleNow.js";
export { novaTpPickAtLock } from "./teamPredictionBundles/novaTpPickAtLock.js";



// Jerseys
export { generateUserJersey } from "./jerseys/generateUserJersey.js";


export * from "./firstGoalChallenge/firstGoalResolveMutualized.js";
export { lockFirstGoalChallenges } from "./firstGoalChallenge/firstGoalLock.js";
export { fgcPick } from "./firstGoalChallenge/fgcPick.js";
export { fgcCreate } from "./firstGoalChallenge/fgcCreate.js";
export { applyFirstGoalChallengePayout } from "./firstGoalChallenge/applyFirstGoalChallengePayout.js";
export { novaFgcPickAtLock } from "./firstGoalChallenge/novaFgcPickAtLock.js";

export {
  detectMlbFirstRbiCandidates_mutualized,
  confirmPendingMlbFirstRbiGames_mutualized,
  repairConfirmedMlbFirstRbiChallenges,
  repairMlbFirstRbiGameCallable,
} from "./firstGoalChallenge/firstRbiResolveMutualized.js";

export { repairFirstGoalGameCallable } from "./firstGoalChallenge/repairFirstGoalGameCallable.js";

// Baseball

export { refreshMlbStandings,refreshMlbPreviousSeasonStandingsDaily} from "./mlb/mlbStandingsIngest.js";
export { cronIngestMlbPlayerStatsDaily, ingestMlbPlayerStatsForSeason } from "./mlb/mlbPlayerStatsIngest.js";
export { refreshMlbRecentSchedule,refreshMlbScheduleWindow,updateMlbScheduleWindowNow } from "./mlb/mlbScheduleContextIngest.js";
export {
  cronEnsureMlbGameConditions,
  ensureMlbGameConditionsNow,
  ensureMlbGameConditionsForDate,
} from "./mlb/ensureMlbGameConditions.js";

export { backfillPlayerStatsDenorm } from "./players/playerStatsDenorm.js";

export { refreshMlbPlayers,refreshMlbPlayersCron } from "./mlbPlayers.js";

export { createDailyFgcAutopilot } from "./autopilot/createDailyFgcAutopilot.js";
export {
  disableInactiveAutopilotCron,
  disableInactiveAutopilotNow,
} from "./autopilot/disableInactiveAutopilot.js";
