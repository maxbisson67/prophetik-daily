/** Seuils alignés sur gameConditionsScoring.js */
export function scoreToLabel(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "neutral";
  if (s >= 70) return "very_favorable";
  if (s >= 55) return "favorable";
  if (s >= 40) return "neutral";
  return "unfavorable";
}

export function computeParkTempContextScore(parkScore, temperatureScore, weatherNeutralized = false) {
  const toFiniteScore = (v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const park = toFiniteScore(parkScore);
  const temp = weatherNeutralized ? toFiniteScore(50) : toFiniteScore(temperatureScore);
  if (park == null && temp == null) return null;
  if (park == null) return temp;
  if (temp == null) return park;
  return Math.round(0.65 * park + 0.35 * temp);
}

export function labelColor(label, isDark) {
  const key = String(label || "").toLowerCase();
  if (key === "very_favorable") return isDark ? "#86EFAC" : "#16A34A";
  if (key === "favorable") return isDark ? "#4ADE80" : "#22C55E";
  if (key === "unfavorable") return isDark ? "#F87171" : "#EF4444";
  return isDark ? "#FBBF24" : "#F59E0B";
}

export function labelBgColor(label, isDark) {
  const key = String(label || "").toLowerCase();
  if (key === "very_favorable") return isDark ? "rgba(22,163,74,0.22)" : "rgba(22,163,74,0.12)";
  if (key === "favorable") return isDark ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.1)";
  if (key === "unfavorable") return isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.1)";
  return isDark ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.1)";
}

export function labelText(label, lang) {
  const isFr = lang !== "en";
  const mapFr = {
    very_favorable: "Très favorable",
    favorable: "Favorable",
    neutral: "Neutre",
    unfavorable: "Défavorable",
  };
  const mapEn = {
    very_favorable: "Very favorable",
    favorable: "Favorable",
    neutral: "Neutral",
    unfavorable: "Unfavorable",
  };
  const map = isFr ? mapFr : mapEn;
  return map[String(label || "").toLowerCase()] || map.neutral;
}

/** Libellé score parc/météo — précise l'impact offensif. */
export function offensiveLabelText(label, lang) {
  const isFr = lang !== "en";
  const mapFr = {
    very_favorable: "Très favorable à l'offensive",
    favorable: "Favorable à l'offensive",
    neutral: "Neutre pour l'offensive",
    unfavorable: "Défavorable à l'offensive",
  };
  const mapEn = {
    very_favorable: "Very offense-friendly",
    favorable: "Offense-friendly",
    neutral: "Neutral for offense",
    unfavorable: "Offense-unfriendly",
  };
  const map = isFr ? mapFr : mapEn;
  return map[String(label || "").toLowerCase()] || map.neutral;
}

export function confidenceDots(confidence) {
  const c = String(confidence || "medium").toLowerCase();
  if (c === "high") return 4;
  if (c === "low") return 2;
  return 3;
}

export function statTier(value, kind) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "neutral";
  if (kind === "slg") {
    if (n >= 0.5) return "strong";
    if (n >= 0.42) return "medium";
    return "weak";
  }
  if (kind === "era") {
    if (n <= 3.2) return "weak";
    if (n >= 4.5) return "strong";
    return "medium";
  }
  return "neutral";
}

export function tierLabel(tier, lang) {
  const isFr = lang !== "en";
  if (tier === "strong") return isFr ? "fort" : "strong";
  if (tier === "weak") return isFr ? "faible" : "weak";
  if (tier === "medium") return isFr ? "moyen" : "avg";
  return isFr ? "—" : "—";
}

export function formatSlg(slg) {
  const raw = String(slg ?? "").trim();
  if (!raw) return "—";
  if (raw.startsWith(".")) return raw;
  const n = Number(raw);
  if (Number.isFinite(n) && n < 1) return n.toFixed(3).replace(/^0/, "");
  return raw;
}

export function parseEraValue(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw.startsWith(".") ? `0${raw}` : raw);
  return Number.isFinite(n) ? n : null;
}

export function formatEraDisplay(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = parseEraValue(raw);
  if (n == null) return raw;
  return n.toFixed(2);
}

export function formatPitcherWinsLosses(pitcher) {
  if (!pitcher || typeof pitcher !== "object") return null;
  const wins = pitcher.wins;
  const losses = pitcher.losses;
  if (wins == null || wins === "" || losses == null || losses === "") return null;
  const w = Number(wins);
  const l = Number(losses);
  if (!Number.isFinite(w) || !Number.isFinite(l)) return null;
  return `${w}-${l}`;
}

/**
 * @param {object|null} pitcher
 * @param {{ teamAbbr?: string|null }} [fallback]
 */
export function normalizePitcherIndicator(pitcher, fallback = {}) {
  if (!pitcher?.name) return null;

  const eraDisplay = formatEraDisplay(pitcher.era);
  const eraNum = parseEraValue(pitcher.era);

  return {
    id: pitcher.id ?? null,
    name: pitcher.name,
    era: eraDisplay,
    winsLosses: formatPitcherWinsLosses(pitcher),
    throwHand: pitcher.throwHand || null,
    teamAbbr: fallback.teamAbbr || pitcher.teamAbbr || null,
    matchupTier: statTier(eraNum, "era"),
  };
}

export function excerptObservation(text, maxLen = 140) {
  const s = String(text || "").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1).trim()}…`;
}
