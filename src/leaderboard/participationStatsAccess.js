/**
 * Qui peut voir la section « Participation aux défis » dans Classement.
 * Ajoute ton Firebase Auth uid (un ou plusieurs).
 */
export const PARTICIPATION_STATS_ALLOWED_UIDS = new Set([
  "Bvuy3cwtnyLZqcyNje124mWKcqB2",
]);

export function canViewGroupParticipationStats(uid) {
  const id = String(uid || "").trim();
  if (!id) return false;
  return PARTICIPATION_STATS_ALLOWED_UIDS.has(id);
}
