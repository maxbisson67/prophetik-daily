// app/lib/push/registerPushToken.js
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@src/lib/firebase";
import { Platform } from "react-native";

export async function registerPushTokenForUser(uid) {
  if (!uid) return null;

  // Permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // Token Expo <-> FCM (expo-notifications gère la passerelle)
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  const token = tokenData?.data;
  if (!token) return null;

  // Stocker dans participants/{uid}.fcmTokens (map)
  const userRef = doc(db, "participants", uid);
  await setDoc(
    userRef,
    {
      fcmTokens: { [token]: true },
      fcmUpdatedAt: new Date(),
    },
    { merge: true }
  );

  // Android: config canal
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("challenges", {
      name: "Défis",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  return token;
}