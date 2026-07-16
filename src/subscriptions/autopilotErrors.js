import i18n from "@src/i18n/i18n";

function extractDetails(e) {
  return e?.details && typeof e.details === "object" ? e.details : {};
}

function isFailedPrecondition(e) {
  return String(e?.code || "").includes("failed-precondition");
}

function messageIncludes(e, key) {
  return String(e?.message || e?.key || "").includes(key);
}

export function parseAutopilotLimitError(e) {
  const details = extractDetails(e);

  if (
    isFailedPrecondition(e) &&
    messageIncludes(e, "AUTOPILOT_GROUP_LIMIT_REACHED")
  ) {
    const max = Number(details.max ?? 0);
    return i18n.t("subscriptions.autopilotLimitMessage", {
      max: max || "?",
      defaultValue:
        "Votre forfait permet d'automatiser jusqu'à {{max}} groupe(s). Désactivez Autopilot sur un autre groupe ou passez à un forfait supérieur.",
    });
  }

  if (
    isFailedPrecondition(e) &&
    messageIncludes(e, "AUTOPILOT_RESOLUTION_REQUIRED")
  ) {
    const max = Number(details.max ?? 0);
    return i18n.t("subscriptions.autopilotResolutionRequiredMessage", {
      max: max || "?",
      defaultValue:
        "Votre forfait permet {{max}} groupe(s) en défis automatiques. Choisissez les groupes à conserver dans l'écran de gestion.",
    });
  }

  return null;
}

export function parseGroupConfigError(e) {
  return (
    parseAutopilotLimitError(e) ||
    String(e?.message || e || i18n.t("common.unknownError", { defaultValue: "Erreur" }))
  );
}
