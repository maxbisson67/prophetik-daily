import i18n from "@src/i18n/i18n";

const MAP = {
  OWNER_ONLY: "groups.teamSplit.errors.ownerOnly",
  ROSTER_UID_NOT_PARTICIPATING: "groups.teamSplit.errors.memberNotParticipating",
  INVALID_TEAM_ID: "groups.teamSplit.errors.invalidTeam",
  TEAM_NAME_TOO_LONG: "groups.teamSplit.errors.teamNameTooLong",
  GROUP_NOT_FOUND: "groups.teamSplit.errors.groupNotFound",
};

export function parseGroupTeamSplitError(e) {
  const code = String(e?.code || "");
  const message = String(e?.message || e || "");

  if (
    code.includes("not-found") &&
    !message.includes("GROUP_NOT_FOUND")
  ) {
    return i18n.t("groups.teamSplit.errors.functionNotDeployed", {
      defaultValue:
        "La fonction setGroupTeamSplit n'est pas déployée. Lance : firebase deploy --only functions:setGroupTeamSplit",
    });
  }

  for (const [key, i18nKey] of Object.entries(MAP)) {
    if (message.includes(key)) {
      return i18n.t(i18nKey, { defaultValue: defaultFor(key) });
    }
  }

  if (message.includes("GROUP_ID_MISSING")) {
    return i18n.t("groups.teamSplit.errors.groupIdMissing", {
      defaultValue: "Identifiant du groupe manquant. Rouvre l'écran du groupe.",
    });
  }

  return null;
}

function defaultFor(code) {
  const d = {
    OWNER_ONLY: "Seul le propriétaire peut modifier les équipes.",
    ROSTER_UID_NOT_PARTICIPATING: "Un membre assigné ne participe pas activement.",
    INVALID_TEAM_ID: "Équipe invalide.",
    TEAM_NAME_TOO_LONG: "Nom d'équipe trop long.",
    GROUP_NOT_FOUND: "Groupe introuvable.",
  };
  return d[code] || code;
}
