// src/leaderboard/utils.js
export function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

export function dedupeById(arr) {
  const m = new Map();
  for (const g of arr || []) m.set(String(g.id), g);
  return Array.from(m.values());
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function safeStr(v, fallback = '') {
  const s = String(v ?? '');
  return s ? s : fallback;
}