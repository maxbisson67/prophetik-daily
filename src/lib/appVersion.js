export function normalizeVersion(v) {
  return String(v || "")
    .trim()
    .split(".")
    .map((x) => Number(x) || 0);
}

export function compareVersions(a, b) {
  const va = normalizeVersion(a);
  const vb = normalizeVersion(b);
  const len = Math.max(va.length, vb.length);

  for (let i = 0; i < len; i += 1) {
    const na = va[i] || 0;
    const nb = vb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function isVersionBelow(current, minimum) {
  const min = String(minimum || "").trim();
  if (!min) return false;
  const currentVersion = String(current || "").trim();
  if (!currentVersion) return false;
  return compareVersions(currentVersion, min) < 0;
}

/**
 * Lit la config mobile pour la plateforme courante.
 * Schéma cible (option A) :
 * {
 *   ios: { minSupportedVersion, storeUrl },
 *   android: { minSupportedVersion, storeUrl },
 *   updateMessageFr, updateMessageEn
 * }
 */
export function resolvePlatformMobileConfig(config, platform) {
  if (!config || typeof config !== "object") {
    return { minSupportedVersion: "", storeUrl: null };
  }

  const nested = platform === "ios" ? config.ios : platform === "android" ? config.android : null;

  const minSupportedVersion = String(
    nested?.minSupportedVersion || config.minSupportedVersion || ""
  ).trim();

  let storeUrl = nested?.storeUrl || null;
  if (!storeUrl) {
    if (platform === "ios") storeUrl = config.iosStoreUrl || null;
    if (platform === "android") storeUrl = config.androidStoreUrl || null;
  }

  return {
    minSupportedVersion,
    storeUrl: storeUrl ? String(storeUrl).trim() : null,
  };
}
