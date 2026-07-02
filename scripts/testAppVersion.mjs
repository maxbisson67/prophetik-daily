/**
 * Tests unitaires pour la comparaison semver (option A).
 * Logique alignée sur src/lib/appVersion.js
 * Usage: node scripts/testAppVersion.mjs
 */

function normalizeVersion(v) {
  return String(v || "")
    .trim()
    .split(".")
    .map((x) => Number(x) || 0);
}

function compareVersions(a, b) {
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

function isVersionBelow(current, minimum) {
  const min = String(minimum || "").trim();
  if (!min) return false;
  const currentVersion = String(current || "").trim();
  if (!currentVersion) return false;
  return compareVersions(currentVersion, min) < 0;
}

function resolvePlatformMobileConfig(config, platform) {
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testCompareVersions() {
  assert(compareVersions("3.0.2", "3.0.2") === 0, "3.0.2 == 3.0.2");
  assert(compareVersions("3.0.1", "3.0.2") === -1, "3.0.1 < 3.0.2");
  assert(compareVersions("3.1.0", "3.0.2") === 1, "3.1.0 > 3.0.2");
  assert(compareVersions("3.0.10", "3.0.2") === 1, "3.0.10 > 3.0.2");
  assert(compareVersions("2.0.0", "10.0.0") === -1, "2.0.0 < 10.0.0");
}

function testIsVersionBelow() {
  assert(isVersionBelow("3.0.1", "3.0.2") === true, "below min");
  assert(isVersionBelow("3.0.2", "3.0.2") === false, "equal min");
  assert(isVersionBelow("3.0.3", "3.0.2") === false, "above min");
  assert(isVersionBelow("3.0.2", "") === false, "empty min => no block");
  assert(isVersionBelow("", "3.0.2") === false, "empty current => no block");
}

function testResolvePlatformMobileConfig() {
  const config = {
    ios: { minSupportedVersion: "3.0.3", storeUrl: "https://ios.example" },
    android: { minSupportedVersion: "3.0.2", storeUrl: "https://android.example" },
    updateMessageFr: "Bonjour",
  };

  const ios = resolvePlatformMobileConfig(config, "ios");
  assert(ios.minSupportedVersion === "3.0.3", "ios min");
  assert(ios.storeUrl === "https://ios.example", "ios store");

  const android = resolvePlatformMobileConfig(config, "android");
  assert(android.minSupportedVersion === "3.0.2", "android min");
  assert(android.storeUrl === "https://android.example", "android store");

  const legacy = resolvePlatformMobileConfig(
    {
      minSupportedVersion: "2.0.0",
      iosStoreUrl: "https://legacy-ios",
      androidStoreUrl: "https://legacy-android",
    },
    "ios"
  );
  assert(legacy.minSupportedVersion === "2.0.0", "legacy min fallback");
  assert(legacy.storeUrl === "https://legacy-ios", "legacy ios store fallback");
}

testCompareVersions();
testIsVersionBelow();
testResolvePlatformMobileConfig();

console.log("✅ testAppVersion: all tests passed");
