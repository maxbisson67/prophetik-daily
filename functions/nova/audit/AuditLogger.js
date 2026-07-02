import { db, FieldValue } from "../../utils.js";

const COLLECTION = "nova_coach_logs";

export class AuditLogger {
  /**
   * @param {{ uid: string, capability: string, domain?: string, provider?: string, cacheHit?: boolean, usage?: object, latencyMs?: number, schemaValid?: boolean, error?: string|null }}
   */
  async log(entry) {
    if (!entry?.uid) return;

    const ref = db.collection(COLLECTION).doc();

    await ref.set({
      uid: entry.uid,
      capability: entry.capability || "coach",
      domain: entry.domain || null,
      provider: entry.provider || null,
      cacheHit: entry.cacheHit === true,
      inputTokens: Number(entry.usage?.inputTokens) || 0,
      outputTokens: Number(entry.usage?.outputTokens) || 0,
      latencyMs: Number(entry.latencyMs) || 0,
      schemaValid: entry.schemaValid !== false,
      error: entry.error ? String(entry.error).slice(0, 200) : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
