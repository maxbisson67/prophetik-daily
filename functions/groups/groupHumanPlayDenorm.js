import { FieldValue } from "firebase-admin/firestore";

/**
 * Denorm : dernier jour (Toronto YYYY-MM-DD) où au moins un humain a participé aux défis du groupe.
 * Utilisé par le cron inactivité autopilot (Pack A #1).
 */
export async function recordGroupHumanParticipationYmd(db, groupId, ymdDashed) {
  const gid = String(groupId || "").trim();
  const ymd = String(ymdDashed || "").slice(0, 10);
  if (!gid || !ymd) return;

  await db.doc(`groups/${gid}`).set(
    {
      lastHumanParticipationYmd: ymd,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * true si lastHumanParticipationYmd = le jour évalué (participation certaine).
 * null sinon → le cron inactivité doit scanner les entries (last ≠ veille ne prouve pas l'absence).
 */
export function groupHadHumanPlayOnYmd(group = {}, evaluatedYmd) {
  const last = String(group?.lastHumanParticipationYmd || "").slice(0, 10);
  const evalY = String(evaluatedYmd || "").slice(0, 10);
  if (!evalY || !last) return null;
  if (last === evalY) return true;
  return null;
}
