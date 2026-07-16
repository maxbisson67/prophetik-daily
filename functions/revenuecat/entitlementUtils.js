import { FieldValue } from "../utils.js";

export function computeEffective(tiers, nowMs) {
  const vipActive = tiers?.vip?.expiresAtMs
    ? tiers.vip.expiresAtMs > nowMs
    : !!tiers?.vip?.active;
  const proActive = tiers?.pro?.expiresAtMs
    ? tiers.pro.expiresAtMs > nowMs
    : !!tiers?.pro?.active;

  if (vipActive) return { tier: "vip", expiresAtMs: tiers.vip.expiresAtMs || null };
  if (proActive) return { tier: "pro", expiresAtMs: tiers.pro.expiresAtMs || null };
  return { tier: "free", expiresAtMs: null };
}

export function normalizeTiers(prev = {}) {
  return {
    pro: { ...(prev?.pro || {}) },
    vip: { ...(prev?.vip || {}) },
  };
}

export function normalizeTierFlags(tiers, nowMs) {
  for (const k of ["pro", "vip"]) {
    const exp = tiers?.[k]?.expiresAtMs ?? null;
    tiers[k] = {
      ...(tiers[k] || {}),
      active: exp != null ? exp > nowMs : !!tiers?.[k]?.active,
    };
  }
  return tiers;
}

export function tierFromProductOrEntitlement({ entitlementIds = [], productIds = [] } = {}) {
  const ent = entitlementIds.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  if (ent.includes("vip")) return "vip";
  if (ent.includes("pro")) return "pro";

  const candidates = productIds.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  for (const id of candidates) {
    if (id.endsWith(":vipmonth") || id.includes("vip.monthly") || id.includes("vipmonth")) {
      return "vip";
    }
    if (id.endsWith(":promonth") || id.includes("pro.monthly") || id.includes("promonth")) {
      return "pro";
    }
  }

  for (const id of candidates) {
    const parts = id.split(/[^a-z0-9]+/).filter(Boolean);
    if (parts.includes("vipmonth") || parts.includes("vip")) return "vip";
    if (parts.includes("promonth") || parts.includes("pro")) return "pro";
  }

  return "free";
}

export function tierFromEvent(event) {
  const ids = Array.isArray(event?.entitlement_ids) ? event.entitlement_ids : [];
  const one = event?.entitlement_id ? [event.entitlement_id] : [];
  const pid = String(event?.product_id || "").trim();
  const spid = String(event?.store_product_id || "").trim();

  return tierFromProductOrEntitlement({
    entitlementIds: [...ids, ...one],
    productIds: [pid, spid],
  });
}

function parseExpiresMs(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const d = new Date(value);
  const n = d.getTime();
  return Number.isFinite(n) ? n : null;
}

export function tiersFromRcEntitlements(activeEntitlements = {}, nowMs = Date.now()) {
  const tiers = { pro: {}, vip: {} };

  for (const key of ["pro", "vip"]) {
    const ent = activeEntitlements?.[key];
    if (!ent || typeof ent !== "object") continue;

    const expMs =
      parseExpiresMs(ent.expiresAtMs) ??
      parseExpiresMs(ent.expires_date) ??
      parseExpiresMs(ent.expirationDate) ??
      parseExpiresMs(ent.expiresDate);

    const active =
      ent.isActive === true ||
      ent.active === true ||
      (expMs != null ? expMs > nowMs : false);

    if (!active && expMs == null) continue;

    tiers[key] = {
      active: expMs != null ? expMs > nowMs : active,
      expiresAtMs: expMs,
      updatedAtMs: nowMs,
      lastEventType: "SYNC",
      lastEventId: `sync_${nowMs}`,
    };
  }

  return normalizeTierFlags(tiers, nowMs);
}

export function mergeTiersFromSnapshot(prevTiers, incomingTiers, nowMs) {
  const tiers = normalizeTiers(prevTiers);

  for (const key of ["pro", "vip"]) {
    const incoming = incomingTiers?.[key];
    if (!incoming || typeof incoming !== "object") continue;

    const prevExpires = Number(tiers?.[key]?.expiresAtMs || 0);
    const nextExpires = incoming.expiresAtMs ?? null;
    const bestExpires =
      nextExpires == null ? prevExpires || null : Math.max(prevExpires, nextExpires);

    const nextActive = bestExpires != null ? bestExpires > nowMs : !!incoming.active;

    if (nextActive || bestExpires > prevExpires) {
      tiers[key] = {
        ...(tiers[key] || {}),
        active: nextActive,
        expiresAtMs: bestExpires,
        updatedAtMs: nowMs,
        lastEventType: incoming.lastEventType || "SYNC",
        lastEventId: incoming.lastEventId || `sync_${nowMs}`,
      };
    }
  }

  return normalizeTierFlags(tiers, nowMs);
}

export function buildEntitlementWritePayload({
  appUserId,
  prev = {},
  tiers,
  source = "revenuecat",
  lastEventType = "SYNC",
  lastEventId = null,
  nowMs = Date.now(),
}) {
  const eff = computeEffective(tiers, nowMs);
  const effectiveTier = eff.tier;
  const effectiveExpiresAt = eff.expiresAtMs ? new Date(eff.expiresAtMs) : null;
  const active = effectiveTier !== "free" && (eff.expiresAtMs ? eff.expiresAtMs > nowMs : true);

  return {
    uid: appUserId,
    tier: effectiveTier,
    active,
    expiresAt: effectiveExpiresAt,
    tiers,
    source,
    lastEventType,
    lastEventId: lastEventId || `sync_${nowMs}`,
    updatedAt: FieldValue.serverTimestamp(),
    ...(prev?.createdAt ? null : { createdAt: FieldValue.serverTimestamp() }),
  };
}
