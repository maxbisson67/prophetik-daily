import { Platform } from "react-native";

let initPromise = null;

/**
 * Initialise Firebase App Check (natif seulement).
 * En dev: provider debug — enregistrer le token dans la console Firebase.
 */
export function initAppCheck() {
  if (Platform.OS === "web") return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const appCheck = require("@react-native-firebase/app-check").default;
      const provider = appCheck().newReactNativeFirebaseAppCheckProvider();

      provider.configure({
        android: {
          provider: __DEV__ ? "debug" : "playIntegrity",
        },
        apple: {
          provider: __DEV__ ? "debug" : "appAttestWithDeviceCheckFallback",
        },
      });

      await appCheck().initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
      });

      if (__DEV__) {
        try {
          const { token } = await appCheck().getToken(true);
          console.log("[AppCheck] Debug token (Firebase Console > App Check):", token);
        } catch (tokenErr) {
          console.warn("[AppCheck] Could not fetch debug token:", tokenErr?.message || tokenErr);
        }
      }
    } catch (e) {
      console.warn("[AppCheck] init failed:", e?.message || e);
    }
  })();

  return initPromise;
}
