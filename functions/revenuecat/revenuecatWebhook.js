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

function tierFromEvent(event) {
  // 1) Priorité: entitlements (le plus fiable si tu as 2 entitlements: pro / vip)
  const ids = Array.isArray(event?.entitlement_ids) ? event.entitlement_ids : [];
  const one = event?.entitlement_id ? [event.entitlement_id] : [];
  const allEnt = [...ids, ...one]
    .map((x) => String(x || "").trim().toLowerCase())
    .filter(Boolean);

  if (allEnt.includes("vip")) return "vip";
  if (allEnt.includes("pro")) return "pro";

  // 2) Fallback: product ids (RC + store)
  const pid = String(event?.product_id || "").trim().toLowerCase();        // ex: prophetik_plan:promonth (selon RC config)
  const spid = String(event?.store_product_id || "").trim().toLowerCase(); // ex: prophetik_plan:promonth (Google)
  const candidates = [pid, spid].filter(Boolean);

  // Match strict sur base plan
  // Google base plan format: <subscriptionId>:<basePlanId>
  // -> prophetik_plan:vipmonth / prophetik_plan:promonth
  for (const id of candidates) {
    if (id.endsWith(":vipmonth")) return "vip";
    if (id.endsWith(":promonth")) return "pro";
  }

  // 3) Dernier recours: match strict sur tokens (évite includes("pro"))
  // (optionnel, mais safe)
  for (const id of candidates) {
    const parts = id.split(/[^a-z0-9]+/).filter(Boolean); // tokenize
    if (parts.includes("vipmonth") || parts.includes("vip")) return "vip";
    if (parts.includes("promonth") || parts.includes("pro")) return "pro";
  }

  return "free";
}

function eventTimeMs(event) {
  const n = Number(event?.event_timestamp_ms ?? event?.purchased_at_ms ?? Date.now());
  return Number.isFinite(n) ? n : Date.now();
}

function safeEventKey({ event, type, appUserId }) {
  // 1) idéal : l’ID RevenueCat
  const id = String(event?.id || event?.event_id || event?.eventId || "").trim();
  if (id) return id;

  // 2) fallback déterministe (SANS random)
  const t = eventTimeMs(event);
  const pid = String(event?.product_id || event?.store_product_id || "").trim();
  return `${type}_${appUserId}_${t}_${pid}`;
}

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

function computeEffective(tiers, nowMs) {
  const vipActive = tiers?.vip?.expiresAtMs ? tiers.vip.expiresAtMs > nowMs : !!tiers?.vip?.active;
  const proActive = tiers?.pro?.expiresAtMs ? tiers.pro.expiresAtMs > nowMs : !!tiers?.pro?.active;

  if (vipActive) return { tier: "vip", expiresAtMs: tiers.vip.expiresAtMs || null };
  if (proActive) return { tier: "pro", expiresAtMs: tiers.pro.expiresAtMs || null };
  return { tier: "free", expiresAtMs: null };
}

export const revenuecatWebhook = onRequest(
  { region: "us-central1", cors: true, secrets: [RC_WEBHOOK_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
      try { assertAuth(req); } catch { return res.status(401).send("Unauthorized"); }

      const body = req.body || {};
      const event = body?.event || body;

      const type = String(event?.type || "").toUpperCase();
      const appUserId = String(event?.app_user_id || event?.appUserId || "").trim();
      if (!appUserId) return res.status(200).json({ ok: true, ignored: true, reason: "missing app_user_id" });

      const incomingMs = eventTimeMs(event);
      const safeEventId = safeEventKey({ event, type, appUserId });

      const processedRef = db.collection("revenuecat_events").doc(safeEventId);
      const entRef = db.collection("entitlements").doc(appUserId);

      const result = await db.runTransaction(async (tx) => {
        const already = await tx.get(processedRef);
        if (already.exists) return { applied: false, reason: "duplicate_event" };

        const nowMs = Date.now();
        const tierTouched = tierFromEvent(event);
        const expMs = expirationMsFromEvent(event);

        const snap = await tx.get(entRef);
        const prev = snap.exists ? snap.data() : {};

        const tiers = {
          pro: { ...(prev?.tiers?.pro || {}) },
          vip: { ...(prev?.tiers?.vip || {}) },
        };

        // active “d’accès” (pas “auto-renew”), basé sur expiration
        if (tierTouched === "pro" || tierTouched === "vip") {
        const prevUpdated = Number(tiers?.[tierTouched]?.updatedAtMs || 0);
        const prevExpires = Number(tiers?.[tierTouched]?.expiresAtMs || 0);

            // protège contre events hors-ordre
            if (incomingMs >= prevUpdated) {
                // conserve la meilleure expiration connue (important pour garder VIP jusqu'à la fin)
                const nextExpires =
                expMs == null ? (prevExpires || null) : Math.max(prevExpires, expMs);

                // accès = expiration future
                const nextActive = nextExpires != null ? nextExpires > nowMs : true;

                tiers[tierTouched] = {
                active: nextActive,
                expiresAtMs: nextExpires,
                lastEventType: type,
                lastEventId: safeEventId,
                updatedAtMs: incomingMs,
                };
            }
        }

        // ✅ Normalise les flags active selon expiresAtMs (évite vip.active "stale")
        for (const k of ["pro", "vip"]) {
        const exp = tiers?.[k]?.expiresAtMs ?? null;
        const normalizedActive = exp != null ? exp > nowMs : !!tiers?.[k]?.active;

        tiers[k] = {
            ...(tiers[k] || {}),
            active: normalizedActive,
        };
        }

        const eff = computeEffective(tiers, nowMs);
        const effectiveTier = eff.tier;
        const effectiveExpiresAt = eff.expiresAtMs ? new Date(eff.expiresAtMs) : null;

        const active = effectiveTier !== "free" && (eff.expiresAtMs ? eff.expiresAtMs > nowMs : true);

        tx.set(entRef, {
          uid: appUserId,
          tier: effectiveTier,
          active,
          expiresAt: effectiveExpiresAt,
          tiers,
          source: "revenuecat",
          lastEventType: type,
          lastEventId: safeEventId,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.set(processedRef, {
          type,
          appUserId,
          createdAt: FieldValue.serverTimestamp(),
          applied: true,
          incomingMs,
          tierTouched,
          effectiveTier,
          active,
          effectiveExpiresAt,
        });

        return { applied: true, tierTouched, effectiveTier, active };
      });

      return res.status(200).json({ ok: true, result });
    } catch (e) {
      logger.error("[RC] webhook error", { error: e?.message || String(e) });
      return res.status(500).send("Internal Server Error");
    }
  }
);