/**
 * Contrat interne — tous les fournisseurs LLM implémentent cette interface.
 */
export class ModelProvider {
  /** @returns {string} */
  get id() {
    throw new Error("ModelProvider.id not implemented");
  }

  /**
   * @param {{ messages: Array<{role: string, content: string}>, maxOutputTokens?: number, temperature?: number, jsonMode?: boolean }} params
   * @returns {Promise<{ content: string, usage: { inputTokens: number, outputTokens: number }, model: string, latencyMs: number }>}
   */
  async complete(_params) {
    throw new Error("ModelProvider.complete not implemented");
  }
}
