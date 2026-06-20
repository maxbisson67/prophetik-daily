import i18n from "@src/i18n/i18n";

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function getInjuryDisplay(injury) {
  if (!injury || typeof injury !== "object") return null;
  if (String(injury.source || "").toLowerCase() !== "espn") return null;

  const statusKey = normalizeStatus(injury.status);
  if (!statusKey || statusKey === "unknown") return null;

  const short = String(injury.short || injury.description || "").trim() || null;
  const isOut = statusKey === "out";
  const isDayToDay = statusKey === "daytoday";
  const isQuestionable = statusKey === "questionable";
  const isDoubtful = statusKey === "doubtful";

  let label = i18n.t("firstGoal.pick.injury.unknown", { defaultValue: "Blessure" });

  if (isOut) {
    label = i18n.t("firstGoal.pick.injury.out", { defaultValue: "Out" });
  } else if (isDayToDay) {
    label = i18n.t("firstGoal.pick.injury.dayToDay", { defaultValue: "Jour par jour" });
  } else if (isQuestionable) {
    label = i18n.t("firstGoal.pick.injury.questionable", { defaultValue: "Incertain" });
  } else if (isDoubtful) {
    label = i18n.t("firstGoal.pick.injury.doubtful", { defaultValue: "Doubtful" });
  } else if (statusKey === "probable") {
    label = i18n.t("firstGoal.pick.injury.probable", { defaultValue: "Probable" });
  }

  return {
    status: injury.status,
    label,
    short,
    isOut,
    isDayToDay,
    isQuestionable,
    isDoubtful,
    showIcon: isOut || isDayToDay || isQuestionable || isDoubtful,
    tone: isOut || isDoubtful ? "danger" : "warning",
  };
}

export function isPlayerUnavailable(injury) {
  const info = getInjuryDisplay(injury);
  return !!info?.isOut;
}
