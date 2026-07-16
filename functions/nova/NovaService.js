import { OpenAiMiniProvider } from "./providers/OpenAiMiniProvider.js";
import { MemoryStore } from "./memory/MemoryStore.js";
import { KnowledgeRetriever } from "./knowledge/KnowledgeRetriever.js";
import { ContextBuilder } from "./context/ContextBuilder.js";
import { PromptComposer } from "./prompts/PromptComposer.js";
import { OutputValidator } from "./guardrails/OutputValidator.js";
import { QuotaManager } from "./quotas/QuotaManager.js";
import { CacheLayer } from "./cache/CacheLayer.js";
import { AuditLogger } from "./audit/AuditLogger.js";
import { buildIndicatorsMeta } from "./indicators/buildIndicatorsMeta.js";

function normalizeCapability(value) {
  const v = String(value || "coach").trim().toLowerCase();
  if (v === "explain") return "explain";
  if (v === "indicators") return "indicators";
  return "coach";
}

function normalizeLang(value, memory) {
  const l = String(value || memory?.profile?.language || "fr")
    .trim()
    .toLowerCase();
  return l === "en" ? "en" : "fr";
}

function resolveChallengeType(ctx, verifiedContext) {
  const d = String(ctx?.domain || verifiedContext?.domain || "fgc")
    .trim()
    .toLowerCase();
  if (d === "tp") return "TP";
  if (d === "ts") return "TS";
  return "FGC";
}

function guessFocusSlotFromMessage(message) {
  const raw = String(message || "").toLowerCase();
  const m = raw.match(/match\s*(\d)/);
  if (m) return Number(m[1]);
  if (/premier match|first game|game 1|matchup 1/.test(raw)) return 1;
  if (/deuxième match|second game|game 2|matchup 2/.test(raw)) return 2;
  if (/troisième match|third game|game 3|matchup 3/.test(raw)) return 3;
  return null;
}

/**
 * Point d'entrée unique de la plateforme Nova (MVP).
 */
export class NovaService {
  /**
   * @param {{ openAiApiKey?: string }} deps
   */
  constructor({ openAiApiKey } = {}) {
    this.memoryStore = new MemoryStore();
    this.knowledgeRetriever = new KnowledgeRetriever();
    this.contextBuilder = new ContextBuilder();
    this.promptComposer = new PromptComposer();
    this.outputValidator = new OutputValidator();
    this.quotaManager = new QuotaManager();
    this.cacheLayer = new CacheLayer();
    this.auditLogger = new AuditLogger();

    this.modelProvider = new OpenAiMiniProvider({ apiKey: openAiApiKey || "" });
  }

  /**
   * @param {{ uid: string, capability?: string, message?: string, lang?: string, context?: object }} request
   */
  async run(request) {
    const uid = String(request?.uid || "");
    if (!uid) {
      return { ok: false, error: "UNAUTHENTICATED" };
    }

    const capability = normalizeCapability(request.capability);
    const message = String(request.message || "").trim();
    const ctx = request.context || {};

    if (!message && capability !== "indicators") {
      return { ok: false, error: "MESSAGE_REQUIRED" };
    }

    const memory = await this.memoryStore.load(uid);
    const lang = normalizeLang(request.lang, memory);
    const level = memory.profile?.sportLevel || "beginner";

    let verifiedContext = null;
    let domain = null;

    if (capability === "coach" || capability === "indicators" || ctx.challengeId) {
      try {
        verifiedContext = await this.contextBuilder.build({
          domain: ctx.domain || "fgc",
          sport: ctx.sport || "NHL",
          uid,
          challengeId: ctx.challengeId,
          playerIds: Array.isArray(ctx.playerIds) ? ctx.playerIds : [],
          gameId: ctx.gameId || null,
          focusSlot: ctx.focusSlot ?? guessFocusSlotFromMessage(message),
          focusPlayerHint: ctx.focusPlayerHint || null,
        });
        domain = `${verifiedContext.domain}_${verifiedContext.sport}`.toLowerCase();
      } catch (e) {
        const code = String(e?.message || e);
        if (capability === "indicators") {
          return { ok: false, error: code || "CONTEXT_UNAVAILABLE" };
        }
        if (capability === "coach") {
          if (code === "CHALLENGE_NOT_FOUND" || code === "CHALLENGE_ID_REQUIRED") {
            return { ok: false, error: code };
          }
          verifiedContext = {
            domain: ctx.domain || "fgc",
            sport: String(ctx.sport || "NHL").toUpperCase(),
            challenge: ctx.challengeId ? { id: String(ctx.challengeId) } : null,
            players: [],
            contextPartial: true,
            contextError: code,
          };
          domain = `${verifiedContext.domain}_${verifiedContext.sport}`.toLowerCase();
        }
      }
    }

    if (capability === "indicators") {
      const indicators = buildIndicatorsMeta(verifiedContext);
      if (!indicators) {
        return { ok: false, error: "INDICATORS_NOT_SUPPORTED" };
      }

      await this.auditLogger.log({
        uid,
        capability: "indicators",
        domain,
        provider: "context",
        cacheHit: false,
        schemaValid: true,
      });

      return {
        ok: true,
        data: { ready: true },
        meta: { source: "context", indicators },
      };
    }

    const challengeType = resolveChallengeType(ctx, verifiedContext);
    const sportForKb = ctx.sport || verifiedContext?.sport || "NHL";
    let primaryArticle = await this.knowledgeRetriever.findByMessage(message, {
      sport: sportForKb,
      challengeType,
    });

    const relatedArticles = primaryArticle?.relatedTopics
      ? await this.knowledgeRetriever.getByKeys(primaryArticle.relatedTopics)
      : [];

    const knowledgeExcerpts = [];
    if (primaryArticle) {
      const ex = this.knowledgeRetriever.formatArticleExcerpt(primaryArticle, { lang, level });
      if (ex) knowledgeExcerpts.push(ex);
    }
    for (const article of relatedArticles) {
      const ex = this.knowledgeRetriever.formatArticleExcerpt(article, { lang, level });
      if (ex) knowledgeExcerpts.push(ex);
    }

    const isTpCoach =
      capability === "coach" &&
      String(ctx.domain || verifiedContext?.domain || "")
        .toLowerCase() === "tp";

    const isFgcMlbCoach =
      capability === "coach" &&
      String(ctx.domain || verifiedContext?.domain || "").toLowerCase() === "fgc" &&
      String(ctx.sport || verifiedContext?.sport || "MLB").toUpperCase() === "MLB";

    const isTsMlbCoach =
      capability === "coach" &&
      String(ctx.domain || verifiedContext?.domain || "").toLowerCase() === "ts" &&
      String(ctx.sport || verifiedContext?.sport || "MLB").toUpperCase() === "MLB";

    if (isTpCoach) {
      for (const key of ["team_record", "tp_scoring", "probable_pitcher"]) {
        if (knowledgeExcerpts.some((e) => e.key === key)) continue;
        const article = await this.knowledgeRetriever.getByKey(key);
        if (!article) continue;
        const ex = this.knowledgeRetriever.formatArticleExcerpt(article, { lang, level });
        if (ex) knowledgeExcerpts.push(ex);
      }
    }

    if (isFgcMlbCoach) {
      const injectKeys = ["first_rbi", "probable_pitcher", "team_record"];
      const pickIsAway =
        verifiedContext?.participant?.currentPick?.isAwayTeam === true ||
        verifiedContext?.matchup?.isAwayTeam === true;
      if (pickIsAway) {
        injectKeys.splice(1, 0, "fgc_away_first_inning");
      }
      for (const key of injectKeys) {
        if (knowledgeExcerpts.some((e) => e.key === key)) continue;
        const article = await this.knowledgeRetriever.getByKey(key);
        if (!article) continue;
        const ex = this.knowledgeRetriever.formatArticleExcerpt(article, { lang, level });
        if (ex) knowledgeExcerpts.push(ex);
      }
    }

    if (isTsMlbCoach) {
      for (const key of ["rbi", "ops", "bvp", "probable_pitcher", "era", "platoon_advantage"]) {
        if (knowledgeExcerpts.some((e) => e.key === key)) continue;
        const article = await this.knowledgeRetriever.getByKey(key);
        if (!article) continue;
        const ex = this.knowledgeRetriever.formatArticleExcerpt(article, { lang, level });
        if (ex) knowledgeExcerpts.push(ex);
      }
    }

    if (capability === "explain" && primaryArticle) {
      const kbResponse = this.knowledgeRetriever.buildExplainFromArticle(primaryArticle, {
        lang,
        level,
      });

      if (kbResponse) {
        const quota = await this.quotaManager.checkAndConsume({
          uid,
          capability: "explain",
          source: "knowledge_base",
        });

        if (!quota.allowed) {
          return { ok: false, error: quota.reason || "QUOTA_EXCEEDED", quota };
        }

        await this.memoryStore.touchSession(uid, {
          language: lang,
          topicKeys: [primaryArticle.key],
        });

        await this.auditLogger.log({
          uid,
          capability: "explain",
          domain,
          provider: "knowledge_base",
          cacheHit: true,
          schemaValid: true,
        });

        return { ok: true, data: kbResponse, meta: { source: "knowledge_base", quota } };
      }
    }

    const contextFingerprint = this.cacheLayer.contextFingerprint(verifiedContext);
    const cacheKey = this.cacheLayer.buildKey({
      capability,
      lang,
      level,
      message,
      contextFingerprint,
    });

    const coachDomain =
      String(ctx.domain || verifiedContext?.domain || "").toLowerCase() || null;

    const cached = await this.cacheLayer.get(cacheKey);
    if (cached) {
      const cachedValid = this.outputValidator.validate(JSON.stringify(cached), {
        capability,
        lang,
        domain: coachDomain,
      });
      if (cachedValid.ok) {
        await this.auditLogger.log({
          uid,
          capability,
          domain,
          provider: this.modelProvider.id,
          cacheHit: true,
          schemaValid: true,
        });

        return { ok: true, data: cachedValid.data, meta: { source: "cache", indicators: buildIndicatorsMeta(verifiedContext) } };
      }
    }

    const quota = await this.quotaManager.checkAndConsume({
      uid,
      capability,
      source: "llm",
    });

    if (!quota.allowed) {
      return { ok: false, error: quota.reason || "QUOTA_EXCEEDED", quota };
    }

    const apiKey = this.modelProvider.apiKey;
    if (!apiKey) {
      return { ok: false, error: "OPENAI_NOT_CONFIGURED" };
    }
    if (!apiKey.startsWith("sk-")) {
      return {
        ok: false,
        error: "OPENAI_KEY_INVALID_FORMAT",
        message: "Expected an OpenAI API key starting with sk-.",
      };
    }

    const memoryBlock = this.memoryStore.toPromptBlock(memory);
    const { messages } = this.promptComposer.compose({
      capability,
      lang,
      memoryBlock,
      verifiedContext,
      knowledgeExcerpts,
      userMessage: message,
    });

    let modelResult;
    try {
      modelResult = await this.modelProvider.complete({ messages, maxOutputTokens: 650, jsonMode: true });
    } catch (e) {
      const errMsg = e?.message || String(e);
      const isOpenAiQuota =
        /OPENAI_HTTP_429/i.test(errMsg) || /exceeded your current quota/i.test(errMsg);

      await this.auditLogger.log({
        uid,
        capability,
        domain,
        provider: this.modelProvider.id,
        error: errMsg,
        schemaValid: false,
      });
      return {
        ok: false,
        error: isOpenAiQuota ? "OPENAI_QUOTA_EXCEEDED" : "MODEL_ERROR",
        message: errMsg,
      };
    }

    let validated = this.outputValidator.validate(modelResult.content, {
      capability,
      lang,
      domain: coachDomain,
    });

    if (!validated.ok) {
      try {
        const tpRetryHint =
          coachDomain === "tp"
            ? lang === "en"
              ? "Your previous answer was invalid or omitted required team form (season record, streak, last-10, home/away split). Fill teamFormFactors for BOTH teams from the verified brief, then write observation citing those team factors BEFORE pitchers. Reply with ONLY valid JSON."
              : "Ta réponse précédente est invalide ou omet la forme équipe obligatoire (fiche saison, série, 10 derniers matchs, split domicile/visite). Remplis teamFormFactors pour LES DEUX équipes d'après le brief vérifié, puis rédige l'observation en citant ces facteurs AVANT les lanceurs. Réponds UNIQUEMENT en JSON valide."
            : "Your previous answer was invalid JSON or missing required fields. Reply again with ONLY valid JSON matching the schema.";

        const retry = await this.modelProvider.complete({
          messages: [
            ...messages,
            {
              role: "user",
              content: tpRetryHint,
            },
          ],
          maxOutputTokens: 650,
          jsonMode: true,
        });
        validated = this.outputValidator.validate(retry.content, {
          capability,
          lang,
          domain: coachDomain,
        });
        if (validated.ok) {
          modelResult = retry;
        }
      } catch {
        // keep first validation failure
      }
    }

    if (!validated.ok) {
      await this.auditLogger.log({
        uid,
        capability,
        domain,
        provider: this.modelProvider.id,
        usage: modelResult.usage,
        latencyMs: modelResult.latencyMs,
        schemaValid: false,
        error: validated.error,
      });
      return {
        ok: false,
        error: validated.error || "INVALID_MODEL_OUTPUT",
        message: String(modelResult.content || "").slice(0, 300),
      };
    }

    const ttlMinutes = capability === "coach" ? 30 : 720;
    await this.cacheLayer.set(cacheKey, validated.data, { ttlMinutes });

    await this.memoryStore.touchSession(uid, {
      language: lang,
      topicKeys: [
        primaryArticle?.key,
        validated.data?.learning?.concept,
      ].filter(Boolean),
    });

    await this.auditLogger.log({
      uid,
      capability,
      domain,
      provider: this.modelProvider.id,
      usage: modelResult.usage,
      latencyMs: modelResult.latencyMs,
      cacheHit: false,
      schemaValid: true,
    });

    return {
      ok: true,
      data: validated.data,
      meta: {
        source: "llm",
        provider: this.modelProvider.id,
        model: modelResult.model,
        latencyMs: modelResult.latencyMs,
        quota,
        indicators: buildIndicatorsMeta(verifiedContext),
      },
    };
  }
}
