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

/** true/false si le champ est présent ; null = pas encore de denorm (fallback legacy). */
export function groupHadHumanPlayOnYmd(group = {}, evaluatedYmd) {
  const last = String(group?.lastHumanParticipationYmd || "").slice(0, 10);
  const evalY = String(evaluatedYmd || "").slice(0, 10);
  if (!evalY) return null;
  if (!last) return null;
  return last === evalY;
}
