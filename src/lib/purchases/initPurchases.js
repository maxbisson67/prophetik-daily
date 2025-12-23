// src/lib/purchases/initPurchases.js
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

let configured = false;

export function initPurchases() {
  if (configured) return;
  configured = true;

  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

  const iosApiKey = "test_DHohNcnUlUIteFcDrOEckyviAeF";
  const androidApiKey = "goog_zspInALRAlfiGdAASFKmnpbnjSh";

  const apiKey = Platform.OS === "ios" ? iosApiKey : androidApiKey;
  if (apiKey) Purchases.configure({ apiKey });
}