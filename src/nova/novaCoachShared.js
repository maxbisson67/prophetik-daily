import i18n from "@src/i18n/i18n";

/** @typedef {{ id: string, message: string, capability: 'explain' | 'coach' }} NovaCoachSuggestion */

function item(id, messageKey, capability, extra = {}) {
  return {
    id,
    message: i18n.t(messageKey),
    capability,
    ...extra,
  };
}

/**
 * Groupes Apprendre (KB / explain) vs Stratégies (LLM / coach).
 * @param {{ sport?: string, domain?: string, lang?: string, player?: object|null }} opts
 */
export function getNovaCoachSuggestionGroups({ sport = "NHL", domain = "fgc", lang, player = null } = {}) {
  void lang;
  const isMlb = String(sport || "").toUpperCase() === "MLB";
  const isTp = String(domain || "").toLowerCase() === "tp";
  const isTs = String(domain || "").toLowerCase() === "ts";
  void player?.lineupSlot;

  if (isTp && isMlb) {
    return {
      learn: [
        item("tpTeamRecord", "novaCoach.suggest.tpTeamRecord", "explain"),
        item("tpScoring", "novaCoach.suggest.tpScoring", "explain"),
        item("tpPitcher", "novaCoach.suggest.tpPitcher", "explain"),
        item("era", "novaCoach.suggest.tpEra", "explain"),
      ],
      strategy: [
        item("tpMatch1", "novaCoach.suggest.tpMatch1", "coach"),
        item("risk", "novaCoach.suggest.risk", "coach"),
      ],
    };
  }

  if (isTs && isMlb) {
    return {
      learn: [
        item("rbi", "novaCoach.suggest.rbi", "explain"),
        item("ops", "novaCoach.suggest.ops", "explain"),
        item("learnPlatoon", "novaCoach.suggest.learnPlatoon", "explain"),
        item("learnBvp", "novaCoach.suggest.learnBvp", "explain"),
        item("era", "novaCoach.suggest.era", "explain"),
      ],
      strategy: [],
    };
  }

  if (isMlb) {
    return {
      learn: [
        item("rbi", "novaCoach.suggest.rbi", "explain"),
        item("platoon", "novaCoach.suggest.learnPlatoon", "explain"),
        item("bvp", "novaCoach.suggest.learnBvp", "explain"),
        item("ops", "novaCoach.suggest.ops", "explain"),
        item("era", "novaCoach.suggest.era", "explain"),
        item("learnLineupBasics", "novaCoach.suggest.learnLineupBasics", "explain"),
      ],
      strategy: [],
    };
  }

  return {
    learn: [item("firstGoal", "novaCoach.suggest.firstGoal", "explain")],
    strategy: [
      item("compare", "novaCoach.suggest.compare", "coach"),
      item("risk", "novaCoach.suggest.risk", "coach"),
    ],
  };
}

/** @deprecated Préférer getNovaCoachSuggestionGroups */
export function getNovaCoachSuggestions(opts = {}) {
  const { learn, strategy } = getNovaCoachSuggestionGroups(opts);
  return [...learn, ...strategy].map((s) => s.message);
}

/**
 * Question unique « Avis de Nova » pour la modal joueur FGC.
 * @param {{ sport?: string, domain?: string }} opts
 */
export function getNovaCoachPlayerAdvice({ sport = "NHL", domain = "fgc" } = {}) {
  const isMlb = String(sport || "").toUpperCase() === "MLB";
  const d = String(domain || "").toLowerCase();
  if (isMlb && d === "ts") {
    return item("tsPlayerAdvice", "novaCoach.suggest.tsPlayerAdvice", "coach");
  }
  if (isMlb) {
    return item("fgcPlayerAdvice", "novaCoach.suggest.fgcPlayerAdvice", "coach");
  }
  if (d === "tp") {
    return item("tpPlayerAdvice", "novaCoach.suggest.tpMatch1", "coach");
  }
  return item("playerAdvice", "novaCoach.suggest.playerAdvice", "coach");
}

/**
 * Question unique « Avis de Nova » pour la modal match TP.
 * @param {{ sport?: string, slot?: number|string|null }} opts
 */
export function getNovaCoachMatchAdvice({ sport = "MLB", slot = null } = {}) {
  const isMlb = String(sport || "").toUpperCase() === "MLB";
  if (!isMlb) return null;

  return {
    id: "tpMatchAdvice",
    message: i18n.t("novaCoach.suggest.tpMatchAdvice", {
      defaultValue:
        "Analyse ce match pour ma prédiction d'équipe : lanceurs probables, forme récente des équipes, tendances au marqueur et principaux risques. Donne une recommandation claire sans choisir un score à ma place.",
      slot: slot ?? "—",
    }),
    capability: "coach",
  };
}

export function resolveNovaCapability(message, explicitCapability) {
  if (explicitCapability === "explain" || explicitCapability === "coach") {
    return explicitCapability;
  }
  return isExplainQuestion(message) ? "explain" : "coach";
}

export function isExplainQuestion(text) {
  return /c'est quoi|c'est qu'|qu'est-ce|what is|what's|explain|explique|définition|definition|comment ça marche|how does.*work/i.test(
    String(text || "")
  );
}

function isUnavailablePlaceholder(value) {
  const v = String(value || "").trim().toLowerCase();
  return !v || v === "unavailable" || v === "non disponible" || v === "n/a" || v === "unknown";
}

function formatTeamFormSide(side) {
  if (!side?.abbr) return "";
  const lines = [`${side.abbr}`];
  const add = (labelKey, value) => {
    if (isUnavailablePlaceholder(value)) return;
    lines.push(`${i18n.t(labelKey)} ${value}`);
  };

  add("novaCoach.teamForm.record", side.seasonRecord);
  add("novaCoach.teamForm.streak", side.streak);
  add("novaCoach.teamForm.lastTen", side.lastTen);
  add("novaCoach.teamForm.split", side.split);
  add("novaCoach.teamForm.offenseDefense", side.offenseDefense);
  return lines.length > 1 ? lines.join("\n") : "";
}

export function formatCoachBody(data) {
  if (!data || typeof data !== "object") return "";

  if (data.capability === "explain" || data.body) {
    if (data.capability === "explain" && data.source === "knowledge_base") {
      const parts = [data.summary || data.body, data.prophetikUse].filter(Boolean);
      return parts.join("\n\n");
    }
    const parts = [data.summary, data.body, data.prophetikUse].filter(Boolean);
    return parts.join("\n\n");
  }

  const parts = [];
  const tf = data.teamFormFactors;
  if (tf?.away || tf?.home) {
    const teamBlocks = [
      formatTeamFormSide(tf.away),
      formatTeamFormSide(tf.home),
    ].filter(Boolean);
    if (teamBlocks.length) {
      parts.push(`${i18n.t("novaCoach.teamFormHeader")}\n${teamBlocks.join("\n\n")}`);
    }
  }

  if (data.comparison?.pitchingNote) {
    parts.push(data.comparison.pitchingNote);
  }

  if (data.observation) parts.push(data.observation);
  if (Array.isArray(data.risks) && data.risks.length) {
    parts.push(data.risks.map((r) => `• ${r}`).join("\n"));
  }
  if (data.reflection) parts.push(data.reflection);
  if (data.disclaimer) parts.push(data.disclaimer);
  return parts.join("\n\n");
}

export function coachTitle(data) {
  if (!data) return "";
  if (data.title) return data.title;
  if (data.learning?.concept) {
    return i18n.t("novaCoach.learningTitle");
  }
  if (data.capability === "coach" && !data.learning?.concept) {
    return i18n.t("novaCoach.adviceTitle");
  }
  return i18n.t("novaCoach.title");
}

export function normalizeNovaResponse(data) {
  if (!data || typeof data !== "object") return null;
  if (data.data && typeof data.data === "object" && !data.observation && !data.body && !data.title) {
    return data.data;
  }
  return data;
}

export function hasVisibleNovaContent(data) {
  if (!data) return false;
  if (data.capability === "explain" || data.body) {
    return Boolean(formatCoachBody(data));
  }
  return Boolean(
    data.observation ||
      data.reflection ||
      data.teamFormFactors?.away ||
      data.teamFormFactors?.home ||
      (Array.isArray(data.risks) && data.risks.length)
  );
}

export function mapNovaCoachError(e) {
  const key = e?.key || null;
  const blob = `${key || ""} ${e?.reason || ""} ${e?.message || ""} ${e?.detailsText || ""}`;

  if (blob.includes("QUOTA_EXCEEDED")) {
    const details = e?.details && typeof e.details === "object" ? e.details : {};
    const used = Number(details.used);
    const limit = Number(details.limit);
    const period = String(details.period || "").trim();

    if (Number.isFinite(used) && Number.isFinite(limit)) {
      return i18n.t("novaCoach.quotaDetailed", {
        used,
        limit,
        periodLine: "",
        defaultValue:
          "Vous avez utilisé vos {{limit}} conseils Nova du mois ({{used}}/{{limit}}). Votre quota sera réinitialisé au prochain cycle, ou vous pouvez passer à un forfait supérieur.",
      });
    }

    return i18n.t("novaCoach.quota");
  }
  if (blob.includes("OPENAI_NOT_CONFIGURED") || blob.includes("OPENAI_KEY_INVALID_FORMAT")) {
    return i18n.t("novaCoach.notConfigured");
  }
  if (blob.includes("OPENAI_QUOTA_EXCEEDED") || blob.includes("OPENAI_HTTP_429")) {
    return i18n.t("novaCoach.openAiQuota");
  }
  if (blob.includes("MODEL_ERROR")) {
    return i18n.t("novaCoach.modelError");
  }
  if (blob.includes("EMPTY_NOVA_RESPONSE")) {
    return i18n.t("novaCoach.empty");
  }
  if (__DEV__ && key) {
    return i18n.t("novaCoach.devError", { key });
  }
  return i18n.t("novaCoach.error");
}

export function formatLineupSlotLabel(slot) {
  const n = Number(slot);
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;
  return i18n.t("novaCoach.lineupSlotShort", { slot: n });
}
