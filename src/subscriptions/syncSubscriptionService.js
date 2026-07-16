import functions from "@react-native-firebase/functions";

function serializeEntitlement(ent) {
  if (!ent || typeof ent !== "object") return null;

  const expirationDate =
    ent.expirationDate instanceof Date
      ? ent.expirationDate.toISOString()
      : ent.expirationDate || ent.expiresDate || null;

  return {
    isActive: ent.isActive === true,
    expirationDate,
    productIdentifier: ent.productIdentifier || ent.product_identifier || null,
  };
}

export function customerInfoToSyncPayload(customerInfo) {
  const active = customerInfo?.entitlements?.active || {};
  const activeEntitlements = {};

  for (const [key, ent] of Object.entries(active)) {
    const id = String(key || "").trim().toLowerCase();
    if (id !== "pro" && id !== "vip") continue;
    const serialized = serializeEntitlement(ent);
    if (serialized) activeEntitlements[id] = serialized;
  }

  return { activeEntitlements };
}

export async function syncSubscriptionEntitlement(customerInfo = null) {
  const callable = functions().httpsCallable("syncSubscriptionEntitlement");
  const payload = customerInfo ? customerInfoToSyncPayload(customerInfo) : {};
  const res = await callable(payload);
  return res?.data || {};
}
