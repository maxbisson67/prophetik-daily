import { ModelProvider } from "./ModelProvider.js";

const DEFAULT_MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAiMiniProvider extends ModelProvider {
  /**
   * @param {{ apiKey: string, model?: string }} options
   */
  constructor({ apiKey, model = DEFAULT_MODEL }) {
    super();
    this.apiKey = String(apiKey || "")
      .trim()
      .replace(/^["']|["']$/g, "");
    this.model = model;
  }

  get id() {
    return "openai-mini";
  }

  async complete({ messages, maxOutputTokens = 600, temperature = 0.4, jsonMode = true }) {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY missing");
    }

    const started = Date.now();

    const body = {
      model: this.model,
      messages,
      max_tokens: maxOutputTokens,
      temperature,
    };

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = payload?.error?.message || res.statusText || "OpenAI request failed";
      throw new Error(`OPENAI_HTTP_${res.status}: ${msg}`);
    }

    const content = String(payload?.choices?.[0]?.message?.content || "");
    const usage = payload?.usage || {};

    return {
      content,
      usage: {
        inputTokens: Number(usage.prompt_tokens) || 0,
        outputTokens: Number(usage.completion_tokens) || 0,
      },
      model: String(payload?.model || this.model),
      latencyMs: Date.now() - started,
    };
  }
}
