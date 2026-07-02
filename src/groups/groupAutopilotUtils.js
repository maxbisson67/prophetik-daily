/** Autopilot actif par défaut (aligné sur GroupConfigSection / createGroup). */
export function isGroupAutopilotEnabled(group) {
  return group?.autopilotEnabled !== false;
}

/** Groupes éligibles à la création manuelle de défis (autopilot désactivé). */
export function filterGroupsForManualChallengeCreation(groups = []) {
  return (groups || []).filter((g) => g && !isGroupAutopilotEnabled(g));
}
