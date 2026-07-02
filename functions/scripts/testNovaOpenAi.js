#!/usr/bin/env node
/**
 * Test local de la clé OpenAI (sans Firebase).
 *
 * Usage:
 *   cd functions
 *   OPENAI_API_KEY="sk-..." node scripts/testNovaOpenAi.js
 */

const apiKey = String(process.env.OPENAI_API_KEY || "")
  .trim()
  .replace(/^["']|["']$/g, "");

if (!apiKey) {
  console.error("✗ OPENAI_API_KEY manquante");
  console.error("");
  console.error("Exemple (colle ta clé sk-… directement) :");
  console.error('  export OPENAI_API_KEY="sk-proj-..."');
  console.error("  node scripts/testNovaOpenAi.js");
  process.exit(1);
}

if (/^error:/i.test(apiKey) || apiKey.startsWith("[input")) {
  console.error("✗ La variable ne contient pas une clé OpenAI.");
  console.error("  Valeur reçue (début):", apiKey.slice(0, 40));
  console.error("");
  console.error("Si tu as utilisé firebase functions:secrets:access, cette commande a probablement échoué");
  console.error("(auth, projet, permissions) et son message d'erreur a été capturé à la place de la clé.");
  console.error("");
  console.error("Teste plutôt avec ta clé copiée depuis platform.openai.com :");
  console.error('  export OPENAI_API_KEY="sk-proj-..."');
  console.error("  node scripts/testNovaOpenAi.js");
  process.exit(1);
}

if (apiKey.startsWith("{") || apiKey.includes("service_account")) {
  console.error("✗ La valeur ressemble à un JSON Google, pas une clé OpenAI sk-...");
  process.exit(1);
}

if (!apiKey.startsWith("sk-")) {
  console.error("✗ Format inattendu — une clé OpenAI commence par sk-");
  console.error("  Préfixe détecté:", apiKey.slice(0, 12));
  process.exit(1);
}

console.log("✓ Format clé OK, préfixe:", apiKey.slice(0, 12) + "…");

const body = {
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "Reply with JSON: {\"ok\":true}" },
    { role: "user", content: "ping" },
  ],
  max_tokens: 32,
  response_format: { type: "json_object" },
};

const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const payload = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error("✗ OpenAI HTTP", res.status, payload?.error?.message || res.statusText);
  process.exit(1);
}

const content = payload?.choices?.[0]?.message?.content || "";
console.log("✓ OpenAI OK, réponse:", content);
