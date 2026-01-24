// functions/leaderboard/rebuildLeaderboard.js
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { logger } from "firebase-functions";

import { db, rebuildLeaderboardSeasonForGroupLogic } from "./leaderboard.js";

setGlobalOptions({ region: "us-central1", maxInstances: 10, timeoutSeconds: 540 });

/**
 * ✅ HTTP: rebuild d’un groupe pour une saison
 * Query:
 * - groupId
 * - seasonId
 * - fromYmd (YYYY-MM-DD)
 * - toYmd   (YYYY-MM-DD)
 * - clearDirty=1 (optionnel)
 */
export const rebuildLeaderboardSeasonForGroup = onRequest(async (req, res) => {
  try {
    const groupId = String(req.query.groupId || "");
    const seasonId = String(req.query.seasonId || "");
    const fromYmd = String(req.query.fromYmd || "");
    const toYmd = String(req.query.toYmd || "");
    const clearDirty = String(req.query.clearDirty || "") === "1";

    if (!groupId) return res.status(400).json({ error: "Missing groupId" });
    if (!seasonId) return res.status(400).json({ error: "Missing seasonId" });
    if (!fromYmd || !toYmd) return res.status(400).json({ error: "Missing fromYmd/toYmd" });

    const out = await rebuildLeaderboardSeasonForGroupLogic({
      groupId,
      seasonId,
      fromYmd,
      toYmd,
      clearDirty,
    });

    return res.json({ ok: true, ...out });
  } catch (e) {
    logger.error("rebuildLeaderboardSeasonForGroup failed", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * ✅ CRON: rebuild des groupes "dirty" seulement (saison courante)
 *
 * - Exécuter APRÈS finalizeDefiWinners (5AM). Ex: 6:10.
 * - On limite le nombre de groupes par run pour éviter une job "infinie".
 *
 * IMPORTANT:
 * - En MVP, on hardcode season/from/to ici.
 * - Plus tard, on lit depuis app_config/seasons/current.
 */
export const rebuildAllLeaderboardsSeason = onSchedule(
  {
    schedule: "10 5 * * *", // ✅ après 5AM finalize
    //schedule: "*/2 * * * *", // pour test
    timeZone: "America/Toronto",
    region: "us-central1",
  },
  async () => {
    // TODO: remplace par la saison réelle quand tu veux
    const seasonId = "20252026";
    const fromYmd = "2025-10-01";
    const toYmd = "2026-06-30";

    const LIMIT_GROUPS_PER_RUN = 200; // ajuste selon budget/volume

    // ✅ Dirty-only query (requires an index if you add orderBy later)
    const dirtySnap = await db
      .collection("groups")
      .where("leaderboardSeasonDirty", "==", true)
      .limit(LIMIT_GROUPS_PER_RUN)
      .get();

    const ids = dirtySnap.docs.map((d) => d.id);

    logger.info("rebuildAllLeaderboardsSeason: start", {
      dirtyGroups: ids.length,
      limit: LIMIT_GROUPS_PER_RUN,
      seasonId,
      fromYmd,
      toYmd,
    });

    if (!ids.length) {
      logger.info("rebuildAllLeaderboardsSeason: none dirty");
      return { ok: true, dirtyGroups: 0 };
    }

    let ok = 0;
    let fail = 0;

    for (const gid of ids) {
      try {
        await rebuildLeaderboardSeasonForGroupLogic({
          groupId: gid,
          seasonId,
          fromYmd,
          toYmd,
          clearDirty: true, // ✅ clear flag after success
        });
        ok++;
      } catch (e) {
        fail++;
        logger.error("rebuildAllLeaderboardsSeason: failed for group", {
          groupId: gid,
          error: String(e?.message || e),
        });
      }
    }

    logger.info("rebuildAllLeaderboardsSeason: done", {
      ok,
      fail,
      seasonId,
      processed: ids.length,
    });

    return { ok: true, processed: ids.length, okCount: ok, failCount: fail, seasonId };
  }
);