export const LIVE_CHALLENGE_ACCENTS = {
  fgc: "#ef4444",
  tp: "#2563eb",
  ts: "#16a34a",
};

export const LIVE_MULTI_CHALLENGE_ACCENT = "#d97706";

function hasFgcPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  return !!(String(pick.playerId || "").trim() || String(pick.fullName || "").trim());
}

function hasUsableTpPick(pick) {
  if (!pick || typeof pick !== "object") return false;
  const away = pick.predictedAwayScore;
  const home = pick.predictedHomeScore;
  return Number.isFinite(Number(away)) && Number.isFinite(Number(home));
}

export function getActiveLiveChallengeKinds({
  fgcItem = null,
  fgcMyPick = null,
  tpSlot = null,
  tpMyPick = null,
  tsPlayers = [],
} = {}) {
  const kinds = [];
  if (fgcItem && hasFgcPick(fgcMyPick)) kinds.push("fgc");
  if (tpSlot?.item && hasUsableTpPick(tpMyPick)) kinds.push("tp");
  const tsList = Array.isArray(tsPlayers) ? tsPlayers.filter((p) => p?.playerId) : [];
  if (tsList.length) kinds.push("ts");
  return kinds;
}

export function hexWithAlpha(hex, alpha = 0.12) {
  const raw = String(hex || "").replace("#", "");
  if (raw.length !== 6) return `rgba(217, 119, 6, ${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getLiveRowHighlightStyle(colors, kinds = [], { isDark = false } = {}) {
  if (!kinds.length) {
    return {
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    };
  }

  const accent =
    kinds.length === 1 ? LIVE_CHALLENGE_ACCENTS[kinds[0]] || LIVE_MULTI_CHALLENGE_ACCENT : LIVE_MULTI_CHALLENGE_ACCENT;

  return {
    borderColor: accent,
    backgroundColor: hexWithAlpha(accent, isDark ? 0.18 : 0.12),
    borderWidth: 2,
    borderLeftWidth: 5,
    borderLeftColor: accent,
  };
}
