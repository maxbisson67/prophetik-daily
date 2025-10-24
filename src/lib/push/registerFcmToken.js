// src/lib/push/registerFcmToken.js
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { doc, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@src/lib/firebase';

const AS_KEY = 'prophetik:lastPushToken';

// Affichage en foreground (bannière)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// === Listeners d’affichage (équivalent onMessage / onNotificationOpened) ===
export function attachNotificationListeners() {
  const sub1 = Notifications.addNotificationReceivedListener((n) => {
    console.log('Notification reçue (foreground):', n);
  });
  const sub2 = Notifications.addNotificationResponseReceivedListener((r) => {
    console.log('Notification ouverte:', r);
  });
  return () => {
    sub1.remove();
    sub2.remove();
  };
}

// === Permissions + récupération du token ===
// Par défaut on retourne le token Expo Push (simple et fiable).
export async function registerForPushNotificationsAsync() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Permission refusée');

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId; // fallback

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { type: 'expo', value: data };
}

// === Enregistre le token courant pour un utilisateur (participants/{uid}) ===
export async function registerCurrentFcmToken(uid) {
  if (!uid) return null;

  const tok = await registerForPushNotificationsAsync();
  const tokenValue = tok.value; // string (Expo push token ou device token)
  if (!tokenValue) return null;

  // Évite les écritures inutiles
  const prev = await AsyncStorage.getItem(AS_KEY);
  if (prev !== tokenValue) await AsyncStorage.setItem(AS_KEY, tokenValue);

  const pRef = doc(db, 'participants', uid);
  const now = serverTimestamp();

  // Map fcmTokens.{token} = true  (tu gardes ton modèle existant)
  await setDoc(
    pRef,
    { fcmTokens: { [tokenValue]: true }, updatedAt: now, platform: Platform.OS },
    { merge: true }
  );

  // Sous-collection /participants/{uid}/fcm_tokens/{token}
  await setDoc(
    doc(db, 'participants', uid, 'fcm_tokens', tokenValue),
    { token: tokenValue, type: tok.type, updatedAt: now, platform: Platform.OS },
    { merge: true }
  );

  return tokenValue;
}

// === Rafraîchir le token au retour en foreground (pas de onTokenRefresh en Expo) ===
let appStateSub;
export function startFcmTokenRefreshListener(uid) {
  stopFcmTokenRefreshListener();
  appStateSub = AppState.addEventListener('change', async (next) => {
    if (next === 'active' && uid) {
      try {
        const tok = await registerForPushNotificationsAsync();
        const tokenValue = tok.value;
        if (!tokenValue) return;
        const prev = await AsyncStorage.getItem(AS_KEY);
        if (prev !== tokenValue) {
          await AsyncStorage.setItem(AS_KEY, tokenValue);
          const pRef = doc(db, 'participants', uid);
          const now = serverTimestamp();
          await setDoc(
            pRef,
            { fcmTokens: { [tokenValue]: true }, updatedAt: now },
            { merge: true }
          );
          await setDoc(
            doc(db, 'participants', uid, 'fcm_tokens', tokenValue),
            { token: tokenValue, type: tok.type, updatedAt: now, platform: Platform.OS },
            { merge: true }
          );
        }
      } catch (e) {
        console.log('[Push] refresh token on foreground failed:', e?.message || String(e));
      }
    }
  });
}

export function stopFcmTokenRefreshListener() {
  appStateSub?.remove?.();
  appStateSub = undefined;
}

// === Désinscrire (on ne peut pas “révoquer” un Expo push token côté client) ===
// On nettoie simplement Firestore (retire la clé de la map).
export async function unregisterDeviceToken(uid) {
  try {
    const last = await AsyncStorage.getItem(AS_KEY);
    if (uid && last) {
      const pRef = doc(db, 'participants', uid);
      await setDoc(
        pRef,
        { [`fcmTokens.${last}`]: deleteField(), updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    await AsyncStorage.removeItem(AS_KEY);
  } catch {}
}