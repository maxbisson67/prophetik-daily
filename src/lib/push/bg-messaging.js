// src/lib/push/bg-messaging.js
import * as Notifications from "expo-notifications";

// Ce fichier doit être importé AU DÉMARRAGE via app/entry.js
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    console.log("[FCM] Background message reçu:", JSON.stringify(remoteMessage));
    // Si le serveur envoie { notification: ... }, l’OS affiche déjà → pas de doublon
    if (remoteMessage?.notification) return;

    const data  = remoteMessage?.data || {};
    const title = data.title || "Nouveau message";
    const body  = data.body  || "";

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null, // immédiat (canal "default" HIGH)
    });
  } catch {
    // pas de console en headless
  }
});