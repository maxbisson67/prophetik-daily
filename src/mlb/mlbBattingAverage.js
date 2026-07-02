function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseBattingAverage(v) {
  const raw = String(v ?? "").trim();
  if (!raw || raw === "0" || raw === ".000") return 0;
  if (raw.startsWith(".")) return num(raw);
  const n = num(raw);
  if (n > 0 && n < 1) return n;
  if (n >= 1 && n <= 1000) return n / 1000;
  return n;
}

export function formatBattingAverage(v) {
  const raw = String(v ?? "").trim();
  if (raw.startsWith(".") && raw !== ".000") return raw;
  const n = parseBattingAverage(v);
  if (!n) return ".000";
  return n.toFixed(3).replace(/^0(?=\.)/, "");
}

export function resolvePlayerBattingAverage(player = {}, stats = null) {
  for (const src of [player, stats].filter(Boolean)) {
    const raw = String(src.battingAverage ?? src.avg ?? "").trim();
    if (raw && raw !== "0" && raw !== ".000") {
      return formatBattingAverage(raw);
    }
  }

  const hits = num(player.hits ?? stats?.hits);
  const atBats = num(player.atBats ?? stats?.atBats);
  if (atBats > 0) return formatBattingAverage(hits / atBats);

  return ".000";
}
