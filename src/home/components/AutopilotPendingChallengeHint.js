import i18n from "@src/i18n/i18n";

export function getAutopilotPendingChallengeMessage(autopilotEnabled) {
  if (!autopilotEnabled) return null;

  return i18n.t("home.autopilotChallengePending", {
    defaultValue:
      "Ce défi n'est pas encore disponible. Avec la création automatique activée, il sera créé à 6 h 30.",
  });
}

export function resolveChallengeEmptyMessage({
  autopilotEnabled,
  fallbackKey,
  fallbackDefault,
}) {
  return (
    getAutopilotPendingChallengeMessage(autopilotEnabled) ||
    i18n.t(fallbackKey, { defaultValue: fallbackDefault })
  );
}
