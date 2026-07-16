import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";
import { getPlanLimits, readUserPlanTier } from "../subscriptions/planLimits.js";
import { listOwnedGroups } from "./groupOwnership.js";

/**
 * Après un downgrade : le propriétaire choisit quels groupes conservent Autopilot.
 * Les autres passent immédiatement en mode manuel.
 */
export const resolveAutopilotGroups = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

  const keepGroupIds = Array.isArray(req.data?.keepGroupIds)
    ? [...new Set(req.data.keepGroupIds.map(String).filter(Boolean))]
    : [];

  const tier = await readUserPlanTier(db, uid);
  const max = getPlanLimits(tier).autopilotGroupsLimit;

  if (keepGroupIds.length > max) {
    throw new HttpsError("invalid-argument", "TOO_MANY_GROUPS_SELECTED", {
      max,
      selected: keepGroupIds.length,
    });
  }

  const owned = await listOwnedGroups(db, uid);
  const ownedIds = new Set(owned.map((group) => group.id));

  for (const groupId of keepGroupIds) {
    if (!ownedIds.has(groupId)) {
      throw new HttpsError("permission-denied", "GROUP_NOT_OWNED", { groupId });
    }
  }

  const keepSet = new Set(keepGroupIds);
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  owned.forEach((group) => {
    const enabled = keepSet.has(group.id);
    const ref = db.collection("groups").doc(group.id);
    const patch = {
      autopilotEnabled: enabled,
      updatedAt: now,
    };

    if (enabled) {
      patch.autopilotInactivityDays = 0;
      patch.autopilotDisabledReason = FieldValue.delete();
      patch.autopilotDisabledAt = FieldValue.delete();
    }

    batch.set(ref, patch, { merge: true });
  });

  await batch.commit();

  logger.info("resolveAutopilotGroups", {
    uid,
    tier,
    kept: keepGroupIds.length,
    disabled: owned.length - keepGroupIds.length,
  });

  return {
    ok: true,
    kept: keepGroupIds.length,
    disabled: Math.max(0, owned.length - keepGroupIds.length),
    autopilotGroupsLimit: max,
  };
});
