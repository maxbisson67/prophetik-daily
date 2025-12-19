// functions/subscriptions/setPlan.js
import { onCall } from "firebase-functions/v2/https";
import { db, FieldValue, logger } from "../utils.js";
import { APP_TZ, addDays } from "../ProphetikDate.js";
import { getPlanConfig, isValidPlanKey } from "./plans.js";

/**
 * Callable: setPlan
 * data:
 * {
 *   planKey: "free"|"base"|"popular"|"prophetik",
 *   triggerNow?: boolean,        // default true
 *   uid?: string,               // admin only (for tests/support)
 *   reason?: string             // optional (logs)
 * }
 */
export const setPlan = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const authUid = request.auth?.uid;
    if (!authUid) {
      throw new Error("unauthenticated");
    }

    const data = request.data || {};
    const planKey = String(data.planKey || "").trim();
    const triggerNow = data.triggerNow !== false; // default true
    const reason = data.reason ? String(data.reason).slice(0, 200) : "";

    if (!isValidPlanKey(planKey)) {
      throw new Error("invalid-argument: invalid planKey");
    }

    // Admin override (optionnel): tu peux le brancher à une liste admin plus tard
    const targetUid = data.uid ? String(data.uid) : authUid;

    // Si tu ne veux PAS permettre de changer un autre uid:
    // commente ce bloc et force targetUid = authUid.
    if (targetUid !== authUid) {
      // ✅ garde simple: bloque par défaut
      // (quand tu voudras: check une collection admins/{authUid})
      throw new Error("permission-denied: cannot set plan for other user");
    }

    const cfg = getPlanConfig(planKey);
    if (!cfg) throw new Error("invalid-argument: unknown plan config");

    const entRef = db.doc(`entitlements/${targetUid}`);
    const now = new Date();
    const nowTs = FieldValue.serverTimestamp();

    // nextGrantAt: si triggerNow => tout de suite (pour tests ou activation immédiate)
    const nextGrantAt = triggerNow ? now : (prev?.nextGrantAt?.toDate?.() ? prev.nextGrantAt.toDate() : addDays(now, 30))

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(entRef);
      const prev = snap.exists ? snap.data() : null;

      const payload = {
        uid: targetUid,
        planKey: cfg.planKey,
        status: "active",
        monthlyCredits: cfg.monthlyCredits,
        freeCap: cfg.planKey === "free" ? cfg.freeCap : null,
        autoGrant: cfg.autoGrant === true,
        timeZone: APP_TZ,

        // setNextGrantAt:
        nextGrantAt: nextGrantAt ? nextGrantAt : prev?.nextGrantAt ?? null,

        updatedAt: nowTs,
        ...(snap.exists ? null : { createdAt: nowTs }),
      };

      tx.set(entRef, payload, { merge: true });

      // log d’audit super utile
      const evRef = entRef.collection("events").doc();
      tx.set(evRef, {
        type: "SET_PLAN",
        planKey: cfg.planKey,
        monthlyCredits: cfg.monthlyCredits,
        triggerNow,
        reason,
        actorUid: authUid,
        createdAt: nowTs,
        prevPlanKey: prev?.planKey ?? null,
        prevStatus: prev?.status ?? null,
      });
    });

    logger.info("setPlan done", { uid: targetUid, planKey, triggerNow });

    return { ok: true, uid: targetUid, planKey, triggerNow };
  }
);