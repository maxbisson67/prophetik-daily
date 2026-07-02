import { db, FieldValue } from "../../utils.js";

const COLLECTION = "nova_memory";

function normalizeLang(lang) {
  const l = String(lang || "fr").trim().toLowerCase();
  return l === "en" ? "en" : "fr";
}

function normalizeLevel(level) {
  const v = String(level || "beginner").trim().toLowerCase();
  if (v === "expert" || v === "intermediate") return v;
  return "beginner";
}

/**
 * Mémoire participant — domaine Prophetik, indépendante du LLM.
 */
export class MemoryStore {
  /**
   * @param {string} uid
   * @returns {Promise<object>}
   */
  async load(uid) {
    if (!uid) {
      return this.defaultProfile("fr");
    }

    const snap = await db.doc(`${COLLECTION}/${uid}`).get();
    if (!snap.exists) {
      return this.defaultProfile("fr");
    }

    const d = snap.data() || {};
    const profile = d.profile || {};

    return {
      uid,
      profile: {
        sportLevel: normalizeLevel(profile.sportLevel),
        prophetikExperience: profile.prophetikExperience || "new",
        preferredStyle: profile.preferredStyle || "balanced",
        language: normalizeLang(profile.language),
      },
      sessionsCount: Number(d.sessionsCount) || 0,
      topicsSeen: Array.isArray(d.topicsSeen) ? d.topicsSeen.slice(0, 30) : [],
      lastSessionAt: d.lastSessionAt || null,
    };
  }

  defaultProfile(language = "fr") {
    return {
      uid: null,
      profile: {
        sportLevel: "beginner",
        prophetikExperience: "new",
        preferredStyle: "balanced",
        language: normalizeLang(language),
      },
      sessionsCount: 0,
      topicsSeen: [],
      lastSessionAt: null,
    };
  }

  /**
   * Résumé compact injecté dans le prompt (~100 tokens max).
   */
  toPromptBlock(memory) {
    const p = memory?.profile || {};
    return {
      sportLevel: p.sportLevel || "beginner",
      prophetikExperience: p.prophetikExperience || "new",
      preferredStyle: p.preferredStyle || "balanced",
      sessionsCount: memory?.sessionsCount || 0,
      topicsSeen: (memory?.topicsSeen || []).slice(-5),
    };
  }

  /**
   * @param {string} uid
   * @param {{ language?: string, topicKeys?: string[] }} touch
   */
  async touchSession(uid, { language, topicKeys = [] } = {}) {
    if (!uid) return;

    const ref = db.doc(`${COLLECTION}/${uid}`);
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : {};
    const prevTopics = Array.isArray(prev.topicsSeen) ? prev.topicsSeen : [];

    const mergedTopics = [...new Set([...prevTopics, ...topicKeys.map(String)])].slice(-30);

    await ref.set(
      {
        uid,
        profile: {
          sportLevel: normalizeLevel(prev?.profile?.sportLevel),
          prophetikExperience: prev?.profile?.prophetikExperience || "new",
          preferredStyle: prev?.profile?.preferredStyle || "balanced",
          language: normalizeLang(language || prev?.profile?.language),
        },
        sessionsCount: (Number(prev.sessionsCount) || 0) + 1,
        topicsSeen: mergedTopics,
        lastSessionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );
  }
}
