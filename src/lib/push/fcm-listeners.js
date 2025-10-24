// src/lib/push/fcm-listeners.js
import * as Notifications from "expo-notifications";

// Handler d’affichage en foreground (bannière)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function registerFcmDisplayHandlers({ onReceive, onResponse } = {}) {
  const sub1 = Notifications.addNotificationReceivedListener((notification) => {
    // équivalent "message reçu en foreground"
    onReceive?.(notification);
  });

  const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
    // clic sur la notif / action
    onResponse?.(response);
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };

}