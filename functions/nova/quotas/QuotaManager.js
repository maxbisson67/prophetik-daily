import { db, FieldValue } from "../../utils.js";

const COLLECTION = "nova_quotas";

function periodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const DEFAULT_LIMITS = {
  coach: 30,
  explain_llm: 30,
};

/**
 * Quotas mensuels simples (MVP).
 */
export class QuotaManager {
  /**
   * @param {{ uid: string, capability: string, source?: string }}
   */
  async checkAndConsume({ uid, capability, source = "llm" }) {
    if (!uid) return { allowed: false, reason: "NO_UID" };

    const cap = String(capability || "coach").toLowerCase();

    // explain servi depuis la KB = gratuit
    if (cap === "explain" && source === "knowledge_base") {
      return { allowed: true, remaining: null, consumed: false };
    }

    const bucket = cap === "explain" ? "explain_llm" : "coach";
    const limit = DEFAULT_LIMITS[bucket] || 30;
    const period = periodKey();
    const ref = db.doc(`${COLLECTION}/${uid}_${period}`);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const counts = data.counts || {};
      const used = Number(counts[bucket]) || 0;

      if (used >= limit) {
        return { allowed: false, used, limit, period };
      }

      tx.set(
        ref,
        {
          uid,
          period,
          counts: {
            ...counts,
            [bucket]: used + 1,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { allowed: true, used: used + 1, limit, period };
    });

    if (!result.allowed) {
      return {
        allowed: false,
        reason: "QUOTA_EXCEEDED",
        used: result.used,
        limit: result.limit,
        period: result.period,
      };
    }

    return {
      allowed: true,
      remaining: result.limit - result.used,
      period: result.period,
      consumed: true,
    };
  }
}
