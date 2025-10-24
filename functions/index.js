// functions/index.js
// "type": "module" conseillé dans package.json

// Ré-exports depuis les modules
export { notifyOnDefiCreate } from "./notifyOnDefiCreate.js";
export { sendTestPush } from "./sendTestPush.js";

export { onParticipantCreate, freeTopUp } from "./participants.js";
export { joinGroupByCode } from "./groups.js";
export { participateInDefi } from "./participation.js";

export { refreshNhlPlayers, refreshNhlPlayersCron, nightlyNhlPlayers } from "./players.js";

export { cronIngestToday, cronDefiStatus } from "./statusCron.js";
export { ingestStatsForDate, ingestStatsForDateCron, syncDefiLiveScores } from "./ingest.js";

export { finalizeDefiWinners, finalizeAwaitingDefis } from "./finalize.js";

// functions/index.js
export { ingestSkaterStatsForSeason, cronIngestSkaterStatsDaily } from "./nhlIngest.js";

// Gamificationsa
export { onGroupCreated } from './gamification/onGroupCreated.js';
export { onDefiCreated } from './gamification/onDefiCreated.js';
export { onParticipationCreated } from './gamification/onParticipationCreated.js';

// Leader board calculation
export { rebuildLeaderboardForGroup, rebuildAllLeaderboards } from './leaderboard.js';