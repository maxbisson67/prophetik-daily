import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { db, FieldValue, logger } from "../utils.js";

const RC_WEBHOOK_SECRET = defineSecret("REVENUECAT_WEBHOOK_SECRET");

function assertAuth(req) {
  const secret = RC_WEBHOOK_SECRET.value();
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!secret || !token || token !== secret) throw new Error("unauthorized");
}

function normalizeTier(t) {
  const s = String(t || "").toLowerCase();
  return s === "vip" || s === "pro" ? s : "free";
}

// RevenueCat: entitlements souvent dans event.entitlement_ids (array).
// Tu as dit: "free", "pro", "vip" comme entitlement IDs.
// => on mappe: vip > pro > free.
function tierFromEvent(event) {
  const ids = Array.isArray(event?.entitlement_ids) ? event.entitlement_ids : [];
  const lower = ids.map((x) => String(x || "").toLowerCase());

  if (lower.includes("vip")) return "vip";
  if (lower.includes("pro")) return "pro";
  if (lower.includes("free")) return "free"; // si tu crées vraiment cet entitlement dans RC
  return "free";
}

// NB: cancellation ≠ expiration. Le plus fiable: active si expiration dans le futur.
// On prend plusieurs champs possibles selon payload.
function expirationMsFromEvent(event) {
  const ms =
    event?.expiration_at_ms ??
    event?.expires_at_ms ??
    event?.expiration_at?.ms ??
    event?.expires_at?.ms ??
    null;

  const n = Number(ms);
  return Number.isFinite(n) ? n : null;
}

export const revenuecatWebhook = onRequest(
  { region: "us-central1", cors: true, secrets: [RC_WEBHOOK_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try { assertAuth(req); }
      catch { return res.status(401).send("Unauthorized"); }

      const body = req.body || {};
      const event = body?.event || body;

      const type = String(event?.type || "").toUpperCase();
      const appUserId = String(event?.app_user_id || event?.appUserId || "").trim();
      const eventId = String(event?.id || event?.event_id || event?.eventId || "").trim();

      logger.info("[RC] webhook received", { type, appUserId, eventId });

      if (!appUserId) {
        return res.status(200).json({ ok: true, ignored: true, reason: "missing app_user_id" });
      }

      // ✅ Idempotence (très important)
      const safeEventId = eventId || `${type}_${appUserId}_${event?.purchased_at_ms || Date.now()}`;
      const processedRef = db.collection("revenuecat_events").doc(safeEventId);

      const result = await db.runTransaction(async (tx) => {
        const already = await tx.get(processedRef);
        if (already.exists) return { applied: false, reason: "duplicate_event" };

        const tier = normalizeTier(tierFromEvent(event));
        const expMs = expirationMsFromEvent(event);
        const nowMs = Date.now();

        // active déterminé par expiration si dispo
        const active =
          tier === "free" ? false : (expMs ? expMs > nowMs : true);

        const entRef = db.collection("entitlements").doc(appUserId);

        tx.set(
          entRef,
          {
            uid: appUserId,
            tier,
            active,
            expiresAt: expMs ? new Date(expMs) : null,
            updatedAt: FieldValue.serverTimestamp(),
            source: "revenuecat",
            lastEventType: type,
            lastEventId: safeEventId,
          },
          { merge: true }
        );

        tx.set(processedRef, {
          type,
          appUserId,
          createdAt: FieldValue.serverTimestamp(),
          applied: true,
          tier,
          active,
          expiresAt: expMs ? new Date(expMs) : null,
        });

        return { applied: true, tier, active };
      });

      return res.status(200).json({ ok: true, result });
    } catch (e) {
      logger.error("[RC] webhook error", { error: e?.message || String(e) });
      return res.status(500).send("Internal Server Error");
    }
  }
);