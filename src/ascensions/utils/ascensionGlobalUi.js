// src/ascensions/utils/ascensionGlobalUi.js
export function ascGlobalUi(ascKey, ascState) {
  const k = String(ascKey || "").toUpperCase();
  const stepsTotal = Number(ascState?.stepsTotal || (k === "ASC7" ? 7 : 4));

  const completedWinners = Array.isArray(ascState?.completedWinners)
    ? ascState.completedWinners.filter(Boolean)
    : [];

  const isCompleted = completedWinners.length > 0 || !!ascState?.completedAt;

  return {
    title: k === "ASC7" ? "Ascension 7" : "Ascension 4",
    stepsTotal,
    enabled: ascState?.enabled !== false,
    isCompleted,
    completedCount: completedWinners.length,
    cycleLabel:
      ascState?.cycleStartYmd && ascState?.cycleEndYmd
        ? `${ascState.cycleStartYmd} → ${ascState.cycleEndYmd}`
        : null,
    nextGameYmd: ascState?.nextGameYmd || null,
    lastTickNote: ascState?.lastTickNote || null,
    lastCreatedGameYmd: ascState?.lastCreatedGameYmd || null,
    lastFinalizeAt: ascState?.lastFinalizeAt || null,
    lastFinalizeStepType: ascState?.lastFinalizeStepType || null,
  };
}