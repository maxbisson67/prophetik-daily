import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";
import {
  applyResolveActiveGroupsChanges,
  resolveActiveGroupsForUser,
} from "./resolveActiveGroupsCore.js";

/**
 * Après downgrade : choix des groupes où l'utilisateur reste participant actif.
 */
export const resolveActiveGroups = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

  const keepActiveGroupIds = Array.isArray(req.data?.keepActiveGroupIds)
    ? [...new Set(req.data.keepActiveGroupIds.map(String).filter(Boolean))]
    : [];

  try {
    const plan = await resolveActiveGroupsForUser(db, uid, keepActiveGroupIds, {
      now: FieldValue.serverTimestamp(),
    });

    const { updated } = await applyResolveActiveGroupsChanges(db, plan.changes);

    logger.info("resolveActiveGroups", {
      uid: plan.uid,
      tier: plan.tier,
      kept: plan.keepIds.length,
      updated,
      max: plan.max,
      activeMemberships: plan.activeMemberships,
      ownedWithoutMembership: plan.ownedWithoutMembership,
      participatingBefore: plan.participatingBefore,
    });

    return {
      ok: true,
      kept: plan.keepIds.length,
      updated,
      activeGroupsLimit: plan.max,
    };
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("TOO_MANY_GROUPS_SELECTED")) {
      throw new HttpsError("invalid-argument", "TOO_MANY_GROUPS_SELECTED", {
        selected: keepActiveGroupIds.length,
      });
    }
    if (msg.includes("GROUP_NOT_MEMBER")) {
      const groupId = msg.split(": ").pop();
      throw new HttpsError("permission-denied", "GROUP_NOT_ACTIVE_MEMBER", { groupId });
    }
    throw e;
  }
});
