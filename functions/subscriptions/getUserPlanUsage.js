import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../utils.js";
import { getUserPlanUsage } from "../groups/groupTierLimits.js";

export const getUserPlanUsageCallable = onCall(async (req) => {
  const uid = req.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "Authentification requise.");

  const usage = await getUserPlanUsage(db, uid);
  return { ok: true, ...usage };
});
