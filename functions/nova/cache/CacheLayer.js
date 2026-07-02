import { db, FieldValue } from "../../utils.js";
import crypto from "crypto";

const COLLECTION = "nova_coach_cache";

function hashKey(parts) {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/**
 * Cache MVP — clé déterministe, TTL configurable.
 */
export class CacheLayer {
  /**
   * @param {{ capability: string, lang: string, level: string, message: string, contextFingerprint?: string|null, ttlMinutes?: number }}
   */
  buildKey({ capability, lang, level, message, contextFingerprint = null }) {
    const normalizedMessage = String(message || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 500);

    return hashKey({
      capability,
      lang,
      level,
      message: normalizedMessage,
      contextFingerprint: contextFingerprint || null,
    });
  }

  async get(cacheKey) {
    const snap = await db.doc(`${COLLECTION}/${cacheKey}`).get();
    if (!snap.exists) return null;

    const d = snap.data() || {};
    const exp = d.expiresAt?.toDate?.() ? d.expiresAt.toDate().getTime() : 0;
    if (exp && exp < Date.now()) return null;

    return d.response || null;
  }

  async set(cacheKey, response, { ttlMinutes = 45 } = {}) {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await db.doc(`${COLLECTION}/${cacheKey}`).set(
      {
        response,
        expiresAt,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  contextFingerprint(verifiedContext) {
    if (verifiedContext?.domain === "tp") {
      const bundle = verifiedContext.bundle || verifiedContext.challenge;
      if (!bundle?.id) return null;
      const picks = verifiedContext.participant?.picks || {};
      const pickSig = Object.keys(picks)
        .sort()
        .map(
          (gid) =>
            `${gid}:${picks[gid]?.predictedAwayScore ?? "?"}-${picks[gid]?.predictedHomeScore ?? "?"}`
        );
      return hashKey({
        bundleId: bundle.id,
        status: bundle.status,
        picks: pickSig,
        focusedGameId: verifiedContext.focusedGameId || null,
        promptVersion: "tp-v4-team-id-lookup",
      }).slice(0, 24);
    }

    if (!verifiedContext?.challenge) return null;
    const ch = verifiedContext.challenge;
    const players = (verifiedContext.players || []).map((p) => p.playerId).sort();
    const focusId = verifiedContext?.participant?.currentPick?.playerId || null;
    return hashKey({
      challengeId: ch.id,
      status: ch.status,
      players,
      focusPlayerId: focusId,
    }).slice(0, 24);
  }
}
