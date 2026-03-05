// src/lib/purchases/initPurchases.js
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import Constants from "expo-constants";

let configured = false;

function getRuntimeProfile() {
  // 1) env injectée par EAS build (fiable)
  const p1 = process?.env?.EAS_BUILD_PROFILE;
  if (typeof p1 === "string" && p1.trim()) return p1.trim();

  // 2) fallback: channel que TU mets dans app.json extra (si tu veux l’ajouter)
  const p2 = Constants?.expoConfig?.extra?.eas?.channel;
  if (typeof p2 === "string" && p2.trim()) return p2.trim();

  // 3) fallback
  return __DEV__ ? "development" : "production";
}

function isProdLike(profile) {
  return profile === "production" || profile === "internal";
}

function pickRcApiKey(profile) {
  const prod = isProdLike(profile);

  const iosKey = prod ? "goog_zspInALRAlfiGdAASFKmnpbnjSh" : "test_DHohNcnUlUIteFcDrOEckyviAeF";
  const androidKey = prod ? "goog_zspInALRAlfiGdAASFKmnpbnjSh" : "test_DHohNcnUlUIteFcDrOEckyviAeF";

  return Platform.OS === "ios" ? iosKey : androidKey;
}

export function initPurchases() {
  if (configured) return;
  configured = true;

  Purchases.setLogLevel(LOG_LEVEL.ERROR);

  const profile = getRuntimeProfile();
  const apiKey = pickRcApiKey(profile);

  Purchases.configure({ apiKey });
}