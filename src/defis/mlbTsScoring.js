export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Points TS MLB : hit + bonus extra-base (2B/3B/HR) + RBI + run. */
export function mlbPlayerTsPoints({
  hits = 0,
  doubles = 0,
  triples = 0,
  homeRuns = 0,
  rbi = 0,
  runs = 0,
} = {}) {
  const extraBase = num(doubles) + num(triples) + num(homeRuns);
  return num(hits) + num(rbi) + num(runs) + extraBase;
}

export function formatMlbRate(raw) {
  if (raw == null || raw === "") return "—";
  const s = String(raw).trim();
  if (s.startsWith(".")) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n > 0 && n < 1) return n.toFixed(3);
  if (n >= 1 && n < 10) return `.${String(Math.round(n * 1000)).padStart(3, "0")}`;
  return n.toFixed(3);
}

/** Valeur numérique pour trier SLG/OPS (.850 → 0.850). */
export function parseMlbRateSort(raw) {
  if (raw == null || raw === "") return 0;
  const s = String(raw).trim();
  if (s.startsWith(".")) return Number(s) || 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return n > 0 && n < 1 ? n : n / 1000;
}

export function formatMlbOps(raw) {
  return formatMlbRate(raw);
}

export function resolveMlbOps(player, statsDoc = null) {
  const raw = player?.ops ?? statsDoc?.ops ?? null;
  return formatMlbOps(raw);
}

export function formatMlbSlg(raw) {
  return formatMlbRate(raw);
}

export function resolveMlbSlg(player, statsDoc = null) {
  const raw =
    player?.slg ??
    player?.sluggingPercentage ??
    statsDoc?.slg ??
    statsDoc?.sluggingPercentage ??
    null;
  return formatMlbSlg(raw);
}
