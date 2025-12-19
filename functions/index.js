// functions/index.js

export { notifyOnDefiCreate } from "./notifyOnDefiCreate.js";
export { sendTestPush } from "./sendTestPush.js";

export { onParticipantCreate, freeTopUp } from "./participants.js";
export { joinGroupByCode } from "./groups.js";
export { participateInDefi } from "./participation.js";

export { purchaseAvatar } from "./purchaseAvatar.js";
export { purchaseGroupAvatar } from "./purchaseGroupAvatar.js";

export { mirrorParticipantToPublic } from "./publicProfileMirror.js";

export { onAvatarIdChange } from "./onAvatarIdChange.js";

export { issueWebCustomToken } from "./issueWebCustomToken.js";

export { refreshNhlPlayers, refreshNhlPlayersCron, nightlyNhlPlayers } from "./players.js";

export { cronIngestToday, cronDefiStatus } from "./statusCron.js";
export { ingestStatsForDate, ingestStatsForDateCron, syncDefiLiveScores } from "./ingest.js";

export { finalizeDefiWinners, finalizeAwaitingDefis } from "./finalize.js";
export { ingestSkaterStatsForSeason, cronIngestSkaterStatsDaily } from "./nhlIngest.js";

export { onGroupCreated } from "./gamification/onGroupCreated.js";
export { onDefiCreated } from "./gamification/onDefiCreated.js";
export { onParticipationCreated } from "./gamification/onParticipationCreated.js";
export { autoCancelGhostDefis } from './gamification/autoCancelGhostDefis.js';
export { debugSimulateGamification } from './gamification/debugSimulateGamification.js';

export { rebuildLeaderboardForGroup, rebuildAllLeaderboards } from "./leaderboard.js";


export { precheckPhoneLogin } from "./precheckPhoneLogin.js";

export { deleteGroup, leaveGroup } from "./groupsManagement.js"

// Nhl Live
export { updateNhlLiveGamesNow, updateNhlLiveGamesCron} from "./nhlLive.js"

// Subscriptions
//export { grantMonthlyCredits,  setPlan  } from "./subscriptions/index.js";

// Credits et dailyShotBonus
export { dailyShotBonus} from "./credits/dailyShotBonus.js"
export { purchaseCreditsMock } from "./credits/purchaseCreditsMock.js";
