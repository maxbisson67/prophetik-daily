import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { db, FieldValue, logger } from "../utils.js";
import { grantCreditsTx } from "./grantCredits.js";
import { getPack, isValidPackKey } from "./packs.js";
import { CREDIT_SOURCES } from "./creditSources.js";

const RC_WEBHOOK_SECRET = defineSecret("REVENUECAT_WEBHOOK_SECRET");

function assertAuth(req) {
  const secret = RC_WEBHOOK_SECRET.value(); // ✅ Gen2 secret
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!secret || !token || token !== secret) {
    throw new Error("unauthorized");
  }
}

function packKeyFromProductId(productId) {
  return String(productId || "").trim();
}

const PURCHASE_TYPES = new Set(["ONE_TIME_PURCHASE", "NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"]);

export const revenuecatWebhook = onRequest(
  { region: "us-central1", cors: true, secrets: [RC_WEBHOOK_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        assertAuth(req);
      } catch {
        return res.status(401).send("Unauthorized");
      }

      const body = req.body || {};
      const event = body?.event || body;

      const type = String(event?.type || "").toUpperCase();
      const appUserId = String(event?.app_user_id || event?.appUserId || "").trim();
      const productId = event?.product_id || event?.productId;
      const eventId = String(event?.id || event?.event_id || event?.eventId || "").trim();

      logger.info("[RC] webhook received", { type, appUserId, productId, eventId });

      if (!appUserId) return res.status(200).json({ ok: true, ignored: true, reason: "missing app_user_id" });
      if (!PURCHASE_TYPES.has(type)) return res.status(200).json({ ok: true, ignored: true, reason: `type ${type}` });

      const packKey = packKeyFromProductId(productId);
      if (!isValidPackKey(packKey)) return res.status(200).json({ ok: true, ignored: true, reason: `unknown packKey ${packKey}` });

      const pack = getPack(packKey);
      const amount = Number(pack.credits || 0) + Number(pack.bonus || 0);

      const safeEventId = eventId || `${type}_${appUserId}_${packKey}_${event?.purchased_at_ms || Date.now()}`;
      const processedRef = db.collection("revenuecat_events").doc(safeEventId);

      const result = await db.runTransaction(async (tx) => {
        const already = await tx.get(processedRef);
        if (already.exists) return { applied: false, reason: "duplicate_event" };

        const grantId = `rc_${safeEventId}`;

        // ✅ 1) grantCreditsTx fait ses READS puis ses WRITES
        const r = await grantCreditsTx(tx, {
            uid: appUserId,
            amount,
            grantId,
            source: CREDIT_SOURCES.PURCHASE_PACK,
            meta: { packKey, credits: pack.credits, bonus: pack.bonus, rcType: type },
        });

        // ✅ 2) write processedRef APRÈS (aucun read après)
        tx.set(processedRef, {
            type,
            appUserId,
            productId: String(productId || ""),
            packKey,
            createdAt: FieldValue.serverTimestamp(),
            grantId,
            applied: r.applied === true,
            reason: r.reason ?? null,
        });

        return r;
      });

      return res.status(200).json({ ok: true, applied: result.applied === true, result });
    } catch (e) {
      logger.error("[RC] webhook error", { error: e?.message || String(e) });
      return res.status(500).send("Internal Server Error");
    }
  }
);