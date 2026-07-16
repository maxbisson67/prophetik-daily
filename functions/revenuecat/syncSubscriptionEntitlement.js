import { onCall } from "firebase-functions/v2/https";
import { db, logger } from "../utils.js";
import {
  buildEntitlementWritePayload,
  mergeTiersFromSnapshot,
  tiersFromRcEntitlements,
} from "./entitlementUtils.js";

function activeEntitlementsFromClientPayload(payload = {}) {
  const raw = payload?.activeEntitlements || payload?.entitlements?.active || payload?.entitlements || {};
  if (!raw || typeof raw !== "object") return {};

  const out = {};
  for (const [key, ent] of Object.entries(raw)) {
    const id = String(key || "").trim().toLowerCase();
    if (id !== "pro" && id !== "vip") continue;
    if (!ent || typeof ent !== "object") continue;
    out[id] = ent;
  }
  return out;
}

export const syncSubscriptionEntitlement = onCall(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const authUid = request.auth?.uid;
    if (!authUid) throw new Error("unauthenticated");

    const nowMs = Date.now();
    const entRef = db.collection("entitlements").doc(authUid);
    const prevSnap = await entRef.get();
    const prev = prevSnap.exists ? prevSnap.data() : {};

    const clientActive = activeEntitlementsFromClientPayload(request.data || {});
    if (Object.keys(clientActive).length === 0) {
      return {
        ok: true,
        applied: false,
        reason: "no_active_entitlements",
        tier: prev?.tier || "free",
      };
    }

    const incomingTiers = tiersFromRcEntitlements(clientActive, nowMs);
    const tiers = mergeTiersFromSnapshot(prev?.tiers, incomingTiers, nowMs);
    const payload = buildEntitlementWritePayload({
      appUserId: authUid,
      prev,
      tiers,
      source: "revenuecat_client_sync",
      lastEventType: "SYNC",
      nowMs,
    });

    await entRef.set(payload, { merge: true });

    logger.info("[RC] entitlement synced from client", {
      uid: authUid,
      tier: payload.tier,
      active: payload.active,
    });

    return {
      ok: true,
      applied: true,
      tier: payload.tier,
      active: payload.active,
    };
  }
);
