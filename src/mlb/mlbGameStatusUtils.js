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
