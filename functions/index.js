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

export { deleteGroup, leaveGroup, transferGroupOwnership } from "./groups/groupsManagement.js";

// Nhl Live
export { updateNhlLiveGamesNow, updateNhlLiveGamesCron} from "./nhlLive.js"

export { updateNhlStandingsNow, refreshNhlStandings } from "./nhlStandings.js";

// Credits et dailyShotBonus
export { dailyShotBonus} from "./credits/dailyShotBonus.js"
export { purchaseCredits } from "./credits/purchaseCredits.js";

export { revenuecatWebhook } from "./revenuecat/revenuecatWebhook.js";

export { syncNhlInjuries, syncNhlInjuriesManual } from "./nhlInjuriesSync.js";


// Prophetik IA et création de groupe
export { onGroupCreated } from "./groups/onGroupCreated.js";
export { createGroupWithCap } from "./groups/createGroupWithCap.js";
export { joinGroupWithCap } from "./groups/joinGroupWithCap.js";

// Prophetik IA et création de défi
export { onDefiCreated } from "./defis/onDefiCreated.js";
export { novaPickAtLock } from "./defis/novaPickAtLock.js";
export { defisCreate } from "./defis/defisCreate.js";
export { defisJoin } from "./defis/defisJoin.js";

// Leader board
export { rebuildLeaderboardSeasonForGroup, rebuildAllLeaderboardsSeason } from "./leaderboard/rebuildLeaderboard.js";

// Les Ascensions
export { ascensionsCreate } from "./ascensions/ascensionsCreate.js";
export { ascensionsTick } from "./ascensions/ascensionsTick.js";
export { ascensionsDailyNotification } from "./ascensions/ascensionsDailyNotification.js";
export { ascensionsNotifyOnCreate } from "./ascensions/ascensionsNotifyOnCreate.js";
export { finalizeAscensionCycleWinners } from "./ascensions/finalizeAscensionCycleWinners.js";
export { applyAscensionDailyBonus } from "./ascensions/applyAscensionDailyBonus.js";


//export { lockFirstGoalChallenges } from "./firstGoalLock.js";
//export { confirmPendingFirstGoals, onFirstGoalCandidateFromGoalCreated } from "./firstGoalResolve.js";

export * from "./firstGoalChallenge/firstGoalResolveMutualized.js";
export { lockFirstGoalChallenges } from "./firstGoalChallenge/firstGoalLock.js";
export { fgcPick } from "./firstGoalChallenge/fgcPick.js";
export { fgcCreate } from "./firstGoalChallenge/fgcCreate.js";
export { applyFirstGoalChallengePayout } from "./firstGoalChallenge/applyFirstGoalChallengePayout.js";

export { repairFirstGoalGameCallable } from "./firstGoalChallenge/repairFirstGoalGameCallable.js";