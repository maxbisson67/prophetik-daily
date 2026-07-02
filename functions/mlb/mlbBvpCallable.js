import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { bvpDocId, compactBvpForClient, resolveBvpStatsBatch } from "./mlbBvpStats.js";

function str(v) {
  return String(v ?? "").trim();
}

/**
 * Prefetch BvP career stats for roster × probable starter pairs.
 *
 * data.pairs: [{ batterId, pitcherId, batterName?, pitcherName? }]
 */
export const prefetchMlbBvp = onCall({ region: "us-central1" }, async (req) => {
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Auth requise.");
  }

  const pairs = Array.isArray(req.data?.pairs) ? req.data.pairs : [];
  if (!pairs.length) {
    return { ok: true, rows: [] };
  }

  if (pairs.length > 120) {
    throw new HttpsError("invalid-argument", "Trop de paires BvP demandées.");
  }

  const normalized = pairs
    .map((p) => ({
      batterId: str(p?.batterId),
      pitcherId: str(p?.pitcherId),
      batterName: str(p?.batterName) || null,
      pitcherName: str(p?.pitcherName) || null,
    }))
    .filter((p) => p.batterId && p.pitcherId);

  logger.info("[prefetchMlbBvp] start", {
    uid: req.auth.uid,
    pairs: normalized.length,
    sample: normalized.slice(0, 3).map((p) => `${p.batterId}_${p.pitcherId}`),
  });

  const map = await resolveBvpStatsBatch(normalized, { maxConcurrency: 10 });

  const withSample = normalized.filter((p) => {
    const row = map.get(bvpDocId(p.batterId, p.pitcherId));
    return compactBvpForClient(row)?.hasSample === true;
  }).length;

  logger.info("[prefetchMlbBvp] done", {
    uid: req.auth.uid,
    pairs: normalized.length,
    resolved: map.size,
    withSample,
  });

  const rows = normalized.map((p) => {
    const row = map.get(bvpDocId(p.batterId, p.pitcherId));
    const compact = compactBvpForClient(row);
    return compact
      ? {
          ...compact,
          batterId: p.batterId,
          pitcherId: p.pitcherId,
        }
      : {
          batterId: p.batterId,
          pitcherId: p.pitcherId,
          pa: 0,
          hasSample: false,
          confidence: "none",
        };
  });

  return { ok: true, rows };
});
