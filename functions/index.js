// functions/index.js
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, logger, apiWebSchedule, readTS, toYMD  } from "./utils.js";

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
export { debugSimulateGamification } from './gamification/debugSimulateGamification.js';

export { rebuildLeaderboardForGroup, rebuildAllLeaderboards } from "./leaderboard.js";

import { reconcileLive, reconcileLiveManual  } from "./reconcileLive.js";

export { precheckPhoneLogin } from "./precheckPhoneLogin.js";

export { deleteGroup, leaveGroup } from "./groupsManagement.js"

// Nhl Live
export { updateNhlLiveGamesNow, updateNhlLiveGamesCron} from "./nhlLive.js"


// ⚠️ Cloud Scheduler minimum = 1 minute.
// Si tu veux “toutes les 30s”, il faut un ping externe ou une Task Queue.
export const scheduledReconcileLive = onSchedule(
  { schedule: "every 1 minutes", timeZone: "America/Toronto", region: "us-central1" },
  async () => {
    logger.info("reconcilelivecron: tick", { at: new Date().toISOString() });

    // élargis temporairement pour tester. En prod, remets uniquement ["live"].
    const snap = await db.collection("defis").where("status", "in", ["live","open"]).get();
    logger.info("reconcilelivecron: defis matchés", { count: snap.size });

    if (snap.empty) {
      logger.info("reconcilelivecron: aucun défi éligible (status live/open)");
      return;
    }

    for (const doc of snap.docs) {
      const defi = doc.data() || {};
      let gameIds = Array.isArray(defi.games) ? defi.games.filter(Boolean) : [];
      logger.info("reconcilelivecron: défi", {
        defiId: doc.id,
        status: defi.status,
        gamesCount: gameIds.length
      });

      // 🔁 FALLBACK: si pas de games[], on essaie via gameDate
      if (!gameIds.length) {
        const ymd = typeof defi.gameDate === "string"
          ? defi.gameDate
          : (defi.gameDate ? toYMD(readTS(defi.gameDate)) : null);

        if (!ymd) {
          logger.warn("reconcilelivecron: pas de games[] ni gameDate — skip", { defiId: doc.id });
          continue;
        }

        try {
          const sched = await apiWebSchedule(ymd);
          const day   = Array.isArray(sched?.gameWeek) ? sched.gameWeek.find(d => d?.date === ymd) : null;
          const games = day ? (day.games || []) : (Array.isArray(sched?.games) ? sched.games : []);
          gameIds = games.map(g => g.id).filter(Boolean);
          logger.info("reconcilelivecron: fallback schedule -> games", { defiId: doc.id, ymd, gamesCount: gameIds.length });

          // (optionnel) mettre en cache dans le doc du défi pour les runs suivants
          if (gameIds.length) {
            await doc.ref.set({ games: gameIds }, { merge: true });
          }
        } catch (e) {
          logger.error("reconcilelivecron: fallback schedule FAILED", { defiId: doc.id, error: String(e?.message || e) });
          continue;
        }
      }

      if (!gameIds.length) {
        logger.warn("reconcilelivecron: défi sans games[] après fallback — skip", { defiId: doc.id });
        continue;
      }

      try {
        const res = await reconcileLive(doc.id, gameIds);
        logger.info("reconcilelivecron: OK", { defiId: doc.id, ...res });
      } catch (err) {
        logger.error("reconcilelivecron: FAIL", { defiId: doc.id, error: String(err?.message || err) });
      }
    }
  }
);