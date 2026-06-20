export function normalizeStatus(st) {
  return String(st || "").toLowerCase().trim();
}

export const HISTORY_RESULT_STATUSES = new Set([
  "decided",
  "closed",
  "completed",
  "cancelled_ghost",
]);

export function isHistoryResultItem(item) {
  return HISTORY_RESULT_STATUSES.has(normalizeStatus(item?.status));
}

export function formatTpBundleMatchupSummary(bundle = {}) {
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  return games
    .map((slot) => {
      const away = String(slot?.awayAbbr || "").trim().toUpperCase();
      const home = String(slot?.homeAbbr || "").trim().toUpperCase();
      if (!away || !home) return null;

      const official = slot?.officialResult || {};
      const awayScore = official?.awayScore;
      const homeScore = official?.homeScore;
      const score =
        awayScore != null && homeScore != null ? ` ${awayScore}-${homeScore}` : "";

      return `${away}@${home}${score}`;
    })
    .filter(Boolean)
    .join(" · ");
}

export function getTpBundleFirstDeadline(bundle = {}) {
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  let earliest = null;

  for (const slot of games) {
    const lockedAt = slot?.lockedAt;
    if (!lockedAt) continue;
    const ms =
      typeof lockedAt?.toDate === "function"
        ? lockedAt.toDate().getTime()
        : new Date(lockedAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (earliest == null || ms < earliest) earliest = ms;
  }

  return earliest != null ? new Date(earliest) : null;
}

export function mergeTpItemsByDate(bundles = [], legacy = []) {
  const byDate = new Map();

  bundles.forEach((item) => {
    if (item?.dateKey) byDate.set(item.dateKey, item);
  });

  legacy.forEach((item) => {
    if (!item?.dateKey) return;
    if (!byDate.has(item.dateKey)) byDate.set(item.dateKey, item);
  });

  return Array.from(byDate.values());
}

export function tpEntryHasParticipation(entry) {
  if (!entry) return false;
  if (Number(entry?.picksCompletedCount ?? 0) > 0) return true;
  const picks = entry?.picks;
  return picks && typeof picks === "object" && Object.keys(picks).length > 0;
}
