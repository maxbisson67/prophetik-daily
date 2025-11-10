// src/lib/push/notifications-setup.js
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Configuration des notifications côté client.
 * - Crée / met à jour les canaux Android
 * - Demande (optionnel) la permission d’afficher
 *
 * ⚠️ Ne pas redéfinir setNotificationHandler ici si tu le fais déjà dans _layout.js.
 */

// Drapeaux de session (module-scoped) pour éviter les ré-inits
let _didInit = false;
let _didChannels = false;
let _didAskPermission = false;

/**
 * Initialise la config notifications une seule fois.
 * @param {{ requestPermission?: boolean, force?: boolean }} options
 *   - requestPermission: demande l’autorisation d’afficher si nécessaire (def. true)
 *   - force: ignore le cache et refait l’init (rare – debug seulement)
 * @returns {Promise<() => void>} teardown (no-op ici)
 */
export async function setupNotificationsClient({ requestPermission = true, force = false } = {}) {
  if (_didInit && !force) {
    // Déjà initialisé → no-op
    return () => {};
  }
  _didInit = true;

  try {
    // --- Android: canaux ---
    if (Platform.OS === "android" && (!_didChannels || force)) {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Général",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [250, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: "default",
      });

      await Notifications.setNotificationChannelAsync("challenges_v2", {
        name: "Défis (v2)",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [250, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: "default",
      });

      _didChannels = true;
    }

    // --- iOS + Android 13+: permission d’affichage ---
    if (requestPermission && (!_didAskPermission || force)) {
      const current = await Notifications.getPermissionsAsync();
      // iOS: status.granted; Android 13+: same API
      if (!current?.granted) {
        const res = await Notifications.requestPermissionsAsync();
        _didAskPermission = !!res?.granted;
      } else {
        _didAskPermission = true;
      }
    }

  } catch (e) {
    console.log("[Notifications] setupNotificationsClient error:", e?.message || String(e));
  }

  // Ici on ne garde pas de listeners, donc teardown no-op.
  return () => {};
}