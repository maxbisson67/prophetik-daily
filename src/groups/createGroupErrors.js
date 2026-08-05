import i18n from "@src/i18n/i18n";
import { parseAutopilotLimitError } from "@src/subscriptions/autopilotErrors";

export function parseCreateGroupError(e) {
  const code = String(e?.code || "");
  const message = String(e?.message || e || "");
  const details = e?.details && typeof e.details === "object" ? e.details : {};

  const autopilotMessage = parseAutopilotLimitError(e);
  if (autopilotMessage) return autopilotMessage;

  if (
    code.includes("resource-exhausted") &&
    message.includes("GROUP_CREATE_RATE_LIMITED")
  ) {
    return i18n.t("subscriptions.groupCreateRateLimitedMessage", {
      defaultValue:
        "Tu as créé trop de groupes récemment. Réessaie un peu plus tard.",
    });
  }

  return message || i18n.t("common.unknownError", { defaultValue: "Erreur" });
}
