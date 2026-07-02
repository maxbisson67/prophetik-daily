import { lookupPickByGameId } from "@src/defis/tpBundleDisplayHelpers";
import { isTpSlotActionable } from "@src/defis/participant/participantTaskStatus";

function hasCompleteTpPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  const away = pick.predictedAwayScore;
  const home = pick.predictedHomeScore;
  return away != null && home != null && away !== "" && home !== "";
}

/**
 * Progression onglet TP pour un bundle multi-matchs.
 * - enrolled: inscrit sur tous les matchs encore jouables (coche verte)
 * - expiredCount: matchs verrouillés sans prédiction
 */
export function buildTpBundleTabProgress({
  games = [],
  picks = {},
  picksCompletedCount = null,
  scheduleByGameId = {},
  nowMs = Date.now(),
}) {
  const slots = Array.isArray(games) ? games : [];
  const total = slots.length;
  if (!total) return { done: 0, total: 0 };

  let done = Number(picksCompletedCount);
  if (!Number.isFinite(done) || done < 0) {
    done = slots.filter((slot) => {
      const gameId = String(slot?.gameId || "").trim();
      if (!gameId) return false;
      return hasCompleteTpPick(lookupPickByGameId(picks, gameId));
    }).length;
  }

  let expiredCount = 0;
  let actionableUnpicked = 0;

  for (const slot of slots) {
    const gameId = String(slot?.gameId || "").trim();
    if (!gameId) continue;

    const pick = lookupPickByGameId(picks, gameId);
    const hasPick = hasCompleteTpPick(pick);
    const scheduleStatus = scheduleByGameId?.[gameId]?.status;
    const actionable = isTpSlotActionable(slot, { scheduleStatus, nowMs });

    if (!hasPick && !actionable) {
      expiredCount += 1;
    } else if (!hasPick && actionable) {
      actionableUnpicked += 1;
    }
  }

  const result = { done, total, expiredCount };

  if (done >= total) {
    return result;
  }

  const enrolled = done > 0 && actionableUnpicked === 0 && done + expiredCount >= total;
  if (enrolled) {
    return { ...result, enrolled: true };
  }

  if (actionableUnpicked === 0 && done === 0 && expiredCount > 0) {
    return { ...result, expired: true };
  }

  return result;
}
