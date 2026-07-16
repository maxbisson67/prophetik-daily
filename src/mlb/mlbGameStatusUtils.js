/** Statut MLB reporté — abstractGameState peut rester "Final" avec detailedState "Postponed". */
export function isMlbGamePostponed(status = {}) {
  const detailed = String(status?.detailedState || "").toLowerCase();
  const abstract = String(status?.abstractGameState || "").toLowerCase();
  const code = String(status?.statusCode || "").toLowerCase();

  return (
    detailed.includes("postpon") ||
    abstract === "postponed" ||
    code === "di" ||
    code === "ppd"
  );
}

/** Retard météo / technique — distinct de reporté (Postponed). */
export function isMlbGameDelayed(statusOrGame = {}) {
  const status = statusOrGame?.status || statusOrGame || {};
  if (isMlbGamePostponed(status)) return false;
  const detailed = String(status?.detailedState || "").toLowerCase();
  return detailed.includes("delay");
}

export function isMlbScheduleGameSelectable(game = {}) {
  const gameType = String(game?.gameType || "R");
  if (gameType && gameType !== "R") return false;

  const abstractState = String(game?.status?.abstractGameState || "");
  if (["Cancelled", "Postponed"].includes(abstractState)) return false;
  if (isMlbGamePostponed(game?.status || {})) return false;

  return true;
}

function startTimeMs(v) {
  if (!v) return Number.POSITIVE_INFINITY;
  const d =
    typeof v?.toDate === "function"
      ? v.toDate()
      : v instanceof Date
      ? v
      : new Date(v);
  const ms = d?.getTime?.();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** Matchs MLB éligibles pour une date, triés par heure de début. */
export function filterMlbScheduleGames(docs = []) {
  return docs
    .map((doc) => {
      const data = typeof doc?.data === "function" ? doc.data() : doc?.data || doc;
      return { id: doc?.id, ...(data || {}) };
    })
    .filter(isMlbScheduleGameSelectable)
    .sort((a, b) => startTimeMs(a.startTimeUTC) - startTimeMs(b.startTimeUTC));
}
