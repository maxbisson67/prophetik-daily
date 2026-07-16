import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { NovaService } from "./nova/NovaService.js";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

let serviceSingleton = null;

function normalizeOpenAiSecret(raw) {
  return String(raw || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function describeOpenAiKey(key) {
  const k = normalizeOpenAiSecret(key);
  if (!k) return { configured: false, format: "missing" };
  if (k.startsWith("{") || k.includes("service_account")) {
    return { configured: true, format: "google_service_account_json" };
  }
  if (k.startsWith("sk-")) {
    const kind = k.startsWith("sk-svcacct-") ? "openai_service_account" : "openai";
    return { configured: true, format: kind, prefix: k.slice(0, 12) };
  }
  return { configured: true, format: "unknown", prefix: k.slice(0, 8) };
}

function getService(apiKey) {
  const normalized = normalizeOpenAiSecret(apiKey);
  if (!serviceSingleton || serviceSingleton.modelProvider.apiKey !== normalized) {
    serviceSingleton = new NovaService({ openAiApiKey: normalized });
  }
  return serviceSingleton;
}

function throwNovaError(result) {
  const reason = result.error || "NOVA_ERROR";
  const detailMessage = result.message || null;

  logger.error("[novaCoach] request failed", {
    reason,
    message: detailMessage,
  });

  if (reason === "QUOTA_EXCEEDED") {
    throw new HttpsError("resource-exhausted", "QUOTA_EXCEEDED", {
      reason,
      ...(result.quota || {}),
    });
  }
  if (reason === "OPENAI_NOT_CONFIGURED" || reason === "OPENAI_KEY_INVALID_FORMAT") {
    throw new HttpsError("failed-precondition", reason, { reason, message: detailMessage });
  }
  if (reason === "FGC_NHL_ONLY") {
    throw new HttpsError("failed-precondition", "FGC_NHL_ONLY", { reason });
  }
  if (reason === "CHALLENGE_NOT_FOUND" || reason === "CHALLENGE_ID_REQUIRED") {
    throw new HttpsError("not-found", reason, { reason });
  }
  if (reason === "MODEL_ERROR") {
    throw new HttpsError("unavailable", "MODEL_ERROR", { reason, message: detailMessage });
  }
  if (reason === "OPENAI_QUOTA_EXCEEDED") {
    throw new HttpsError("resource-exhausted", "OPENAI_QUOTA_EXCEEDED", {
      reason,
      message: detailMessage,
    });
  }
  if (
    reason === "INVALID_JSON" ||
    reason === "MISSING_COACH_FIELDS" ||
    reason === "MISSING_EXPLAIN_FIELDS" ||
    reason === "INVALID_MODEL_OUTPUT"
  ) {
    throw new HttpsError("internal", reason, { reason, message: detailMessage });
  }

  throw new HttpsError("internal", reason, { reason, message: detailMessage });
}

/**
 * Nova Coach — FGC NHL/MLB + TP MLB.
 *
 * data:
 * {
 *   capability: "coach" | "explain" | "indicators",
 *   message: string,
 *   lang?: "fr" | "en",
 *   context?: {
 *     domain: "fgc" | "tp",
 *     sport: "NHL" | "MLB",
 *     challengeId,
 *     gameId?: string,
 *     playerIds?: string[]
 *   }
 * }
 */
export const novaCoach = onCall(
  {
    region: "us-central1",
    enforceAppCheck: false,
    secrets: [OPENAI_API_KEY],
  },
  async (req) => {
    const uid = req.auth?.uid || null;
    if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

    const capability = String(req.data?.capability || "coach").toLowerCase();
    const message = String(req.data?.message || "").trim();
    const lang = req.data?.lang;
    const context = req.data?.context || {};

    if (!message && capability !== "indicators") {
      throw new HttpsError("invalid-argument", "MESSAGE_REQUIRED");
    }

    if (message.length > 800) {
      throw new HttpsError("invalid-argument", "MESSAGE_TOO_LONG");
    }

    const rawKey = OPENAI_API_KEY.value();
    const keyInfo = describeOpenAiKey(rawKey);

    logger.info("[novaCoach] request", {
      uid,
      capability,
      sport: context?.sport || null,
      challengeId: context?.challengeId || null,
      messageLen: message.length,
      openAiKey: keyInfo,
    });

    if (keyInfo.format === "google_service_account_json") {
      throwNovaError({
        ok: false,
        error: "OPENAI_KEY_INVALID_FORMAT",
        message:
          "Secret looks like a Google service account JSON, not an OpenAI API key (sk-...).",
      });
    }

    if (!keyInfo.configured || keyInfo.format === "unknown") {
      throwNovaError({
        ok: false,
        error: "OPENAI_KEY_INVALID_FORMAT",
        message: `Firebase secret OPENAI_API_KEY has an invalid prefix (${keyInfo.prefix || "empty"}). Re-set it with: printf '%s' 'sk-...' | firebase functions:secrets:set OPENAI_API_KEY`,
      });
    }

    const service = getService(rawKey);

    let result;
    try {
      result = await service.run({
        uid,
        capability,
        message,
        lang,
        context,
      });
    } catch (e) {
      logger.error("[novaCoach] unhandled exception", {
        uid,
        capability,
        error: e?.message || String(e),
        stack: e?.stack || null,
      });
      throw new HttpsError("internal", "NOVA_UNHANDLED", {
        reason: "NOVA_UNHANDLED",
        message: e?.message || String(e),
      });
    }

    if (!result.ok) {
      throwNovaError(result);
    }

    logger.info("[novaCoach] success", {
      uid,
      capability,
      source: result.meta?.source || null,
    });

    return {
      ok: true,
      ...result.data,
      meta: result.meta || {},
    };
  }
);
