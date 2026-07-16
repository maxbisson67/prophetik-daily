import i18n from "@src/i18n/i18n";
import { parseAutopilotLimitError } from "@src/subscriptions/autopilotErrors";

export function parseCreateGroupError(e) {
  const code = String(e?.code || "");
  const message = String(e?.message || e || "");
  const details = e?.details && typeof e.details === "object" ? e.details : {};

  const autopilotMessage = parseAutopilotLimitError(e);
  if (autopilotMessage) return autopilotMessage;

  if (
    code.includes("failed-precondition") &&
    (message.includes("OWNED_GROUP_LIMIT_REACHED") ||
      message.includes("GROUP_LIMIT_REACHED") ||
      message.includes("OWNER_GROUP_LIMIT_REACHED"))
  ) {
    const max = Number(details.max ?? 0);
    const current = Number(details.current ?? 0);

    return i18n.t("subscriptions.ownedGroupsLimitMessage", {
      max: max || "?",
      current: current || "?",
      defaultValue:
        "Votre forfait actuel permet de posséder {{max}} groupe(s). Vous possédez déjà {{current}} groupe(s). Passez à un forfait supérieur pour créer un nouveau groupe.",
    });
  }

  return message || i18n.t("common.unknownError", { defaultValue: "Erreur" });
}
