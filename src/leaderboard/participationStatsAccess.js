/**
 * Section « Participation aux défis » dans l’onglet Classement.
 * Désactivée en prod / pilotes — rapports ops : scripts reports/*.
 * Pour debug UI : passer à true + uid dans PARTICIPATION_STATS_ALLOWED_UIDS.
 */
export const GROUP_PARTICIPATION_LEADERBOARD_VISIBLE = false;

/** UIDs autorisés quand GROUP_PARTICIPATION_LEADERBOARD_VISIBLE === true */
export const PARTICIPATION_STATS_ALLOWED_UIDS = new Set([
  "Bvuy3cwtnyLZqcyNje124mWKcqB2",
]);

export function canViewGroupParticipationStats(uid) {
  if (!GROUP_PARTICIPATION_LEADERBOARD_VISIBLE) return false;
  const id = String(uid || "").trim();
  if (!id) return false;
  return PARTICIPATION_STATS_ALLOWED_UIDS.has(id);
}
