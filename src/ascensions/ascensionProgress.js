// src/ascensions/utils/ascensionProgress.js

export function stepsTotalForAscKey(ascKey) {
  return String(ascKey || "").toUpperCase() === "ASC7" ? 7 : 4;
}

function normalizeWinsByType(winsByType) {
  return winsByType && typeof winsByType === "object" ? winsByType : {};
}

export function getAscMemberProgress({
  ascKey,
  winsByType,
  stepsTotal: stepsTotalOverride,
}) {
  const stepsTotal = Number(stepsTotalOverride || stepsTotalForAscKey(ascKey));
  const wbt = normalizeWinsByType(winsByType);

  let completedSteps = 0;
  const completedMap = {}; // { "1": true, ... }

  for (let i = 1; i <= stepsTotal; i++) {
    const k = String(i);
    const done = wbt[k] === true;
    if (done) completedSteps += 1;
    completedMap[k] = done;
  }

  const ratio = stepsTotal > 0 ? completedSteps / stepsTotal : 0;

  return {
    stepsTotal,
    completedSteps,
    ratio, // 0..1
    label: `${completedSteps}/${stepsTotal}`,
    completed: completedSteps >= stepsTotal,
    completedMap, // utile pour afficher des pastilles (1..stepsTotal)
  };
}