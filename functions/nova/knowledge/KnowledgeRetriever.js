import { db } from "../../utils.js";
import { novaArticlesCollection } from "./paths.js";

function pickTranslation(article, lang) {
  const translations = article?.translations || {};
  const l = lang === "en" ? "en" : "fr";
  return translations[l] || translations.fr || translations.en || null;
}

function levelField(level) {
  const v = String(level || "beginner").toLowerCase();
  if (v === "expert") return "expertExplanation";
  if (v === "intermediate") return "intermediateExplanation";
  return "beginnerExplanation";
}

/**
 * Retrieval simple — pas d'embeddings (MVP).
 */
export class KnowledgeRetriever {
  col() {
    return novaArticlesCollection(db);
  }

  /**
   * @param {string} key
   */
  async getByKey(key) {
    const k = String(key || "").trim().toLowerCase();
    if (!k) return null;

    const direct = await this.col().doc(k).get();
    if (direct.exists) {
      const data = direct.data() || {};
      if (String(data.status || "").toLowerCase() === "published") {
        return { id: direct.id, ...data };
      }
    }

    const q = await this.col()
      .where("key", "==", k)
      .where("status", "==", "published")
      .limit(1)
      .get();

    if (q.empty) return null;
    const doc = q.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Articles liés au contexte FGC NHL.
   */
  async findForChallengeContext({ sport = "NHL", challengeType = "FGC", limit = 4 } = {}) {
    const q = await this.col()
      .where("status", "==", "published")
      .limit(30)
      .get();

    const rows = q.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => {
        const s = String(a.sport || "").toUpperCase();
        if (s !== sport && s !== "ALL") return false;
        const types = Array.isArray(a.challengeTypes) ? a.challengeTypes : [];
        return types.length === 0 || types.includes(challengeType);
      })
      .slice(0, limit);

    return rows;
  }

  /**
   * @param {string[]} keys
   */
  async getByKeys(keys = []) {
    const out = [];
    for (const key of keys.slice(0, 5)) {
      const article = await this.getByKey(key);
      if (article) out.push(article);
    }
    return out;
  }

  /**
   * Devine une clé KB depuis le message (slug simple).
   */
  guessKeyFromMessage(message) {
    const raw = String(message || "").trim().toLowerCase();
    if (!raw) return null;

    const tokens = raw
      .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.includes("rbi") || tokens.includes("rbis")) return "rbi";
    if (tokens.includes("ops")) return "ops";
    if (tokens.includes("era")) return "era";
    if (
      raw.includes("platoon") ||
      raw.includes("avantage platoon") ||
      raw.includes("platoon advantage") ||
      raw.includes("gaucher/droitier") ||
      raw.includes("gaucher / droitier") ||
      raw.includes("left/right matchup") ||
      raw.includes("lefty/righty") ||
      (raw.includes("gaucher") && raw.includes("droitier")) ||
      (raw.includes("left-handed") && raw.includes("right-handed"))
    ) {
      return "platoon_advantage";
    }
    if (
      tokens.includes("bvp") ||
      raw.includes("batter vs pitcher") ||
      raw.includes("batter versus pitcher") ||
      raw.includes("face-à-face") ||
      raw.includes("face a face") ||
      raw.includes("face à face") ||
      raw.includes("historique vs") ||
      raw.includes("history vs") ||
      (raw.includes("carrière") && raw.includes("lanceur")) ||
      (raw.includes("career") && raw.includes("pitcher"))
    ) {
      return "bvp";
    }
    if (tokens.includes("whip")) return "whip";
    if (tokens.includes("ppg") || (tokens.includes("points") && tokens.includes("match"))) {
      return "points_per_game";
    }
    if (
      raw.includes("lanceur partant") ||
      raw.includes("probable starter") ||
      raw.includes("starting pitcher") ||
      (raw.includes("lanceur") && raw.includes("partant"))
    ) {
      return "probable_pitcher";
    }
    if (
      raw.includes("barème") ||
      raw.includes("bareme") ||
      raw.includes("score exact") ||
      (raw.includes("points") && raw.includes("prédire")) ||
      (raw.includes("points") && raw.includes("predict"))
    ) {
      return "tp_scoring";
    }
    if (
      raw.includes("runs allowed") ||
      raw.includes("runs accord") ||
      raw.includes("fiche d") ||
      raw.includes("victoires") ||
      raw.includes("win-loss") ||
      raw.includes("classement") ||
      raw.includes("série") ||
      raw.includes("serie") ||
      raw.includes("sequence") ||
      tokens.includes("streak")
    ) {
      return "team_record";
    }
    if (
      raw.includes("premier point produit") ||
      raw.includes("first rbi") ||
      raw.includes("first run challenge")
    ) {
      return "first_rbi";
    }
    if (
      raw.includes("comment ça marche") ||
      raw.includes("how does it work") ||
      raw.includes("ordre de frappe et premier") ||
      raw.includes("lineup order and first") ||
      raw.includes("visiteur") ||
      raw.includes("visiteuse") ||
      raw.includes("away team") ||
      raw.includes("on the road") ||
      raw.includes("haut de la 1") ||
      raw.includes("top of the 1st") ||
      raw.includes("ordre de frappe") ||
      raw.includes("lineup spot") ||
      raw.includes("lineup order") ||
      raw.includes("premier frappeur") ||
      raw.includes("leadoff") ||
      raw.includes("3e frappeur") ||
      raw.includes("4e frappeur") ||
      raw.includes("cœur d'ordre") ||
      raw.includes("coeur d'ordre") ||
      (raw.includes("frappe") && raw.includes("1re"))
    ) {
      return "fgc_away_first_inning";
    }
    if (raw.includes("premier but") || raw.includes("first goal")) return "first_goal";
    if (raw.includes("fgc") || raw.includes("défi premier") || raw.includes("first run")) {
      return "fgc_rules";
    }

    return null;
  }

  /**
   * Recherche une fiche KB pertinente (MVP — tags / clé / titre).
   */
  async findByMessage(message, { sport = "NHL", challengeType = "FGC" } = {}) {
    const key = this.guessKeyFromMessage(message);
    if (key) {
      const direct = await this.getByKey(key);
      if (direct) return direct;
    }

    const raw = String(message || "").trim().toLowerCase();
    if (!raw) return null;

    const sportUpper = String(sport || "NHL").toUpperCase();
    const q = await this.col().where("status", "==", "published").limit(50).get();

    let best = null;
    let bestScore = 0;

    for (const doc of q.docs) {
      const article = { id: doc.id, ...doc.data() };
      const articleSport = String(article.sport || "").toUpperCase();
      if (articleSport !== sportUpper && articleSport !== "ALL") continue;

      const types = Array.isArray(article.challengeTypes) ? article.challengeTypes : [];
      if (types.length > 0 && challengeType && !types.includes(challengeType)) continue;

      const articleKey = String(article.key || doc.id).toLowerCase();
      let score = 0;

      if (raw.includes(articleKey) || raw.includes(articleKey.replace(/_/g, " "))) {
        score += 5;
      }

      const tags = Array.isArray(article.tags) ? article.tags : [];
      for (const tag of tags) {
        const t = String(tag || "").toLowerCase();
        if (t && raw.includes(t)) score += 3;
      }

      for (const lang of ["fr", "en"]) {
        const title = String(article.translations?.[lang]?.title || "").toLowerCase();
        if (title && raw.includes(title.slice(0, Math.min(title.length, 12)))) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        best = article;
      }
    }

    return bestScore >= 3 ? best : null;
  }

  /**
   * Extrait compact pour injection coach / explain.
   */
  formatArticleExcerpt(article, { lang = "fr", level = "beginner" } = {}) {
    const tr = pickTranslation(article, lang);
    if (!tr) return null;

    const explanation = tr[levelField(level)] || tr.beginnerExplanation || tr.shortAnswer;

    return {
      key: article.key,
      title: tr.title,
      shortAnswer: tr.shortAnswer,
      explanation,
      prophetikUse: tr.prophetikUse || null,
      commonMistakes: Array.isArray(tr.commonMistakes) ? tr.commonMistakes.slice(0, 3) : [],
    };
  }

  /**
   * Réponse explain 100 % KB (0 token LLM) si fiche trouvée.
   */
  buildExplainFromArticle(article, { lang = "fr", level = "beginner" } = {}) {
    const tr = pickTranslation(article, lang);
    if (!tr) return null;

    const explanation = tr[levelField(level)] || tr.beginnerExplanation || tr.shortAnswer;

    return {
      capability: "explain",
      source: "knowledge_base",
      articleKey: article.key,
      title: tr.title,
      summary: tr.shortAnswer,
      body: explanation,
      prophetikUse: tr.prophetikUse || null,
      examples: Array.isArray(tr.examples) ? tr.examples.slice(0, 2) : [],
      relatedTopics: Array.isArray(article.relatedTopics) ? article.relatedTopics.slice(0, 5) : [],
      disclaimer:
        lang === "en"
          ? "Nova helps you learn — your decisions remain yours."
          : "Nova t'aide à apprendre — tes décisions t'appartiennent.",
    };
  }
}
