// src/lib/push/registerPushToken.js
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@src/lib/firebase";

/**
 * Récupère le token FCM (via Expo Notifications) et le stocke dans:
 *  - participants/{uid}.fcmTokens[token] = true
 *  - participants/{uid}/fcm_tokens/{token} = { token, platform, updatedAt }
 * Idempotent: si le token n’a pas changé, on ne réécrit pas pour rien.
 */
export async function registerPushTokenForUser(uid) {
  if (!uid) return;

  // 1) Permissions d’affichage (Android 13+/iOS)
  await Notifications.requestPermissionsAsync();

  // 2) Android: s’assure d’avoir au moins un channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // 3) Récupération du token FCM (pas Exponent…)
  //    getDevicePushTokenAsync() renvoie { data: <FCM_TOKEN> } sur Android/iOS avec FCM
  const device = await Notifications.getDevicePushTokenAsync();
  const token = device?.data;
  if (!token) return;

  // 4) Dédup locale simple
  const lastKey = `prophetik:lastFCM:${uid}`;
  const prev = await AsyncStorage.getItem(lastKey);
  if (prev === token) {
    // rien à faire
  } else {
    await AsyncStorage.setItem(lastKey, token);
  }

  // 5) Écrit/merge en base
  const pRef = doc(db, "participants", uid);
  const now = serverTimestamp();

  await setDoc(
    pRef,
    { fcmTokens: { [token]: true }, updatedAt: now },
    { merge: true }
  );

  await setDoc(
    doc(db, "participants", uid, "fcm_tokens", token),
    { token, platform: Platform.OS, updatedAt: now },
    { merge: true }
  );
}