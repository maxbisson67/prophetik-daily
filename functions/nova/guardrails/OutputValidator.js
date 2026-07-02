const DENY_PATTERNS = [
  /garanti/i,
  /100\s*%/i,
  /sure bet/i,
  /parie tout/i,
  /impossible de perdre/i,
];

function asString(v, max = 2000) {
  return String(v ?? "").slice(0, max);
}

function asStringArray(v, maxItems = 6, maxLen = 300) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

/**
 * Validation légère MVP — pas de dépendance JSON Schema externe.
 */
export class OutputValidator {
  validate(rawContent, { capability = "coach", lang = "fr", domain = null } = {}) {
    let parsed;
    try {
      parsed = JSON.parse(String(rawContent || ""));
    } catch {
      return { ok: false, error: "INVALID_JSON", data: null };
    }

    const cap = String(capability || parsed?.capability || "coach").toLowerCase();
    const disclaimerFr = "Nova t'accompagne — la décision t'appartient.";
    const disclaimerEn = "Nova coaches you — the decision is yours.";

    if (cap === "explain") {
      const data = {
        capability: "explain",
        source: parsed.source === "knowledge_base" ? "knowledge_base" : "llm",
        articleKey: parsed.articleKey ? asString(parsed.articleKey, 80) : null,
        title: asString(parsed.title, 200),
        summary: asString(parsed.summary, 500),
        body: asString(parsed.body, 2500),
        prophetikUse: parsed.prophetikUse ? asString(parsed.prophetikUse, 800) : null,
        examples: asStringArray(parsed.examples),
        relatedTopics: asStringArray(parsed.relatedTopics, 8, 80),
        disclaimer: asString(parsed.disclaimer, 200) || (lang === "en" ? disclaimerEn : disclaimerFr),
      };

      if (!data.title || !data.body) {
        return { ok: false, error: "MISSING_EXPLAIN_FIELDS", data: null };
      }

      return { ok: true, error: null, data: this.applyDenylist(data) };
    }

    const observationRaw =
      parsed.observation ?? parsed.observations ?? parsed.summary ?? parsed.analysis ?? null;

    const isTp = String(domain || "").toLowerCase() === "tp";
    const teamFormFactors = isTp ? this.normalizeTeamFormFactors(parsed.teamFormFactors) : null;

    const data = {
      capability: "coach",
      tone: ["encouraging", "neutral", "analytical"].includes(parsed.tone) ? parsed.tone : "neutral",
      learning: {
        concept: parsed.learning?.concept ? asString(parsed.learning.concept, 80) : null,
        hint: parsed.learning?.hint ? asString(parsed.learning.hint, 300) : null,
      },
      ...(teamFormFactors ? { teamFormFactors } : {}),
      observation: asString(observationRaw, 800),
      comparison: isTp
        ? {
            favoredTeamAbbr: parsed.comparison?.favoredTeamAbbr
              ? asString(parsed.comparison.favoredTeamAbbr, 8)
              : null,
            dimensions: asStringArray(parsed.comparison?.dimensions, 6, 80),
            pitchingNote: parsed.comparison?.pitchingNote
              ? asString(parsed.comparison.pitchingNote, 200)
              : null,
          }
        : {
            favoredPlayerId: parsed.comparison?.favoredPlayerId
              ? asString(parsed.comparison.favoredPlayerId, 40)
              : null,
            alternativePlayerIds: asStringArray(parsed.comparison?.alternativePlayerIds, 3, 40),
            dimensions: asStringArray(parsed.comparison?.dimensions, 5, 80),
          },
      risks: asStringArray(parsed.risks, 4),
      reflection: asString(parsed.reflection, 400),
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium",
      disclaimer: asString(parsed.disclaimer, 200) || (lang === "en" ? disclaimerEn : disclaimerFr),
      followUpSuggestions: asStringArray(parsed.followUpSuggestions, 3, 120),
    };

    if (!data.observation) {
      return { ok: false, error: "MISSING_COACH_FIELDS", data: null };
    }

    if (isTp) {
      const tpCheck = this.validateTpCoachOutput(data, lang);
      if (!tpCheck.ok) {
        return { ok: false, error: tpCheck.error, data: null };
      }
    }

    return { ok: true, error: null, data: this.applyDenylist(data) };
  }

  normalizeTeamFormFactors(raw) {
    if (!raw || typeof raw !== "object") return null;
    const side = (s) => {
      if (!s || typeof s !== "object") return null;
      return {
        abbr: asString(s.abbr, 8) || null,
        seasonRecord: asString(s.seasonRecord, 40) || null,
        streak: asString(s.streak, 20) || null,
        lastTen: asString(s.lastTen, 20) || null,
        split: asString(s.split, 40) || null,
        offenseDefense: asString(s.offenseDefense, 80) || null,
      };
    };
    return { away: side(raw.away), home: side(raw.home) };
  }

  isUnavailablePlaceholder(value) {
    const v = String(value || "").trim().toLowerCase();
    return !v || v === "unavailable" || v === "non disponible" || v === "n/a" || v === "unknown";
  }

  validateTpCoachOutput(data, lang) {
    const tf = data.teamFormFactors;
    if (!tf?.away || !tf?.home) {
      return { ok: false, error: "MISSING_TP_TEAM_FORM" };
    }

    const required = ["seasonRecord", "streak", "lastTen", "split"];
    for (const side of ["away", "home"]) {
      const block = tf[side];
      if (!block?.abbr) {
        return { ok: false, error: "MISSING_TP_TEAM_ABBR" };
      }
      const filled = required.filter(
        (k) => block[k] && !this.isUnavailablePlaceholder(block[k])
      );
      if (filled.length < 2) {
        return { ok: false, error: "INCOMPLETE_TP_TEAM_FORM" };
      }
    }

    const obs = String(data.observation || "").toLowerCase();
    const teamSignals =
      lang === "en"
        ? /record|streak|last.?10|home|away|road|split|w-\d|-\d/.test(obs)
        : /fiche|bilan|série|10 derniers|domicile|visite|extérieur|split|\d-\d/.test(obs);
    if (!teamSignals) {
      return { ok: false, error: "TP_OBSERVATION_MISSING_TEAM_FORM" };
    }

    return { ok: true, error: null };
  }

  applyDenylist(data) {
    const blob = JSON.stringify(data);
    for (const re of DENY_PATTERNS) {
      if (re.test(blob)) {
        return {
          ...data,
          observation: asString(String(data.observation || "").replace(re, ""), 800),
          disclaimer: `${data.disclaimer} Aucun résultat n'est garanti.`,
        };
      }
    }
    return data;
  }
}
