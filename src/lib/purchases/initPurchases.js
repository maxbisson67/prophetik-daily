// src/lib/purchases/initPurchases.js
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import Constants from "expo-constants";

let configured = false;

const GOOGLE_PLAY_RC_KEY = "goog_zspInALRAlfiGdAASFKmnpbnjSh";
const APPLE_APP_RC_KEY = "appl_JQrNgbdEBGafcPAyUBjnKieEVvJ";

function pickRcApiKey() {
  if (Platform.OS === "android") {
    return GOOGLE_PLAY_RC_KEY;
  }

  // iOS : clé App Store (sandbox en dev, prod en TestFlight/App Store).
  return APPLE_APP_RC_KEY;
}

/** Expo Go / web : le module natif RevenueCat n'est pas disponible. */
export function isPurchasesNativeAvailable() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  if (Constants.executionEnvironment === "storeClient") return false;
  return typeof Purchases?.configure === "function";
}

export function isPurchasesConfigured() {
  return configured;
}

export function initPurchases() {
  if (configured) return true;

  if (!isPurchasesNativeAvailable()) {
    if (__DEV__) {
      console.warn(
        "[RC] Module natif indisponible (Expo Go, web ou build sans dev client) — achats ignorés."
      );
    }
    return false;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    const apiKey = pickRcApiKey();
    Purchases.configure({ apiKey });
    configured = true;
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn("[RC] configure failed:", e?.message || String(e));
    }
    return false;
  }
}
