// src/lib/push/notifications-setup.js
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Configure l’app pour recevoir des notifications (côté client).
 * - Crée/maj les canaux Android
 * - (Optionnel) Demande la permission d’afficher
 *
 * NOTE: Ne pas redéfinir setNotificationHandler ici si tu le fais déjà dans _layout.js
 * pour éviter des collisions de config.
 */
export async function setupNotificationsClient({ requestPermission = true } = {}) {
  try {
    if (Platform.OS === "android") {
      // Canal par défaut (local + remote sans canal explicite)
      await Notifications.setNotificationChannelAsync("default", {
        name: "Général",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [250, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: "default",
      });

      // Canal cible pour tes “défis”
      await Notifications.setNotificationChannelAsync("challenges_v2", {
        name: "Défis (v2)",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [250, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: "default",
      });
    }

    if (requestPermission) {
      // iOS + Android 13+ : autorisation d’afficher des notifs (UI)
      await Notifications.requestPermissionsAsync();
    }

    console.log("[Notifications] setupNotificationsClient OK");
  } catch (e) {
    console.log("setupNotificationsClient error:", e?.message || String(e));
  }
}