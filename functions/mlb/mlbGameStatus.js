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

export function isMlbGamePostponedFromLiveFeed(liveFeed) {
  return isMlbGamePostponed(liveFeed?.gameData?.status || {});
}

export function isMlbGameFinal(liveFeed) {
  if (isMlbGamePostponedFromLiveFeed(liveFeed)) return false;

  const abs = String(liveFeed?.gameData?.status?.abstractGameState || "").toLowerCase();
  const detailed = String(liveFeed?.gameData?.status?.detailedState || "").toLowerCase();
  const coded = String(liveFeed?.gameData?.status?.statusCode || "").toLowerCase();
  const inningState = String(liveFeed?.liveData?.linescore?.currentInningState || "").toLowerCase();

  return (
    abs === "final" ||
    detailed.includes("final") ||
    coded === "f" ||
    inningState === "final"
  );
}

export function isMlbGamePreGame(liveFeed) {
  const abs = String(liveFeed?.gameData?.status?.abstractGameState || "").toLowerCase();
  return abs === "preview" || abs === "scheduled";
}

export function isMlbScheduleGamePostponed(game = {}) {
  return isMlbGamePostponed(game?.status || {});
}

export function isMlbScheduleGameSelectable(game = {}) {
  const abstractState = String(game?.status?.abstractGameState || "");
  if (["Cancelled", "Postponed"].includes(abstractState)) return false;
  if (isMlbGamePostponed(game?.status || {})) return false;
  return true;
}
