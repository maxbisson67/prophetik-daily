// src/lib/push/registerFcmToken.js
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const AS_KEY = 'prophetik:lastPushToken';

// ⚠️ Un seul handler global
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// === Listeners d’affichage ===
export function attachNotificationListeners() {
  const sub1 = Notifications.addNotificationReceivedListener((n) => {
    console.log('Notification reçue (foreground):', n);
  });
  const sub2 = Notifications.addNotificationResponseReceivedListener((r) => {
    console.log('Notification ouverte:', r);
  });
  return () => {
    try { sub1.remove(); } catch {}
    try { sub2.remove(); } catch {}
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Anti-spam Expo Push + robustesse
   ────────────────────────────────────────────────────────────────────────── */
let _inflight = null;
let _lastOkToken = null;
let _lastAttemptAt = 0;
let _lastSuccessAt = 0;
const SUCCESS_COOLDOWN_MS = 15 * 60 * 1000; // 15 min
const ERROR_COOLdown_MS   = 20 * 1000;      // 20 s

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => {
  const j = ms * 0.3;
  return Math.max(0, Math.floor(ms + (Math.random() * 2 - 1) * j));
};

function getProjectId() {
  const c = Constants ?? {};
  return (
    c.expoConfig?.extra?.eas?.projectId ||
    c.easConfig?.projectId ||
    c.expoConfig?.projectId ||
    c.projectId ||
    null
  );
}

// Permissions (ne redemande pas si déjà accordé)
async function ensureNotificationPermission() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur?.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req?.granted;
}

// Récupération Expo token avec retry/backoff
async function getExpoTokenWithRetry(maxRetries = 4) {
  const projectId = getProjectId();
  if (!projectId) {
    console.log('[Push] projectId introuvable dans Constants — skip');
    return null;
  }

  let attempt = 0;
  let delay = 1500;

  while (true) {
    try {
      const res = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = res?.data || res;
      if (token && typeof token === 'string') return token;
      throw new Error('Invalid token shape');
    } catch (e) {
      attempt += 1;
      const msg = e?.message || String(e);
      const isLast = attempt > maxRetries;
      console.log(`[Push] getExpoPushToken attempt ${attempt}/${maxRetries} failed: ${msg}`);
      if (isLast) throw e;
      await sleep(jitter(delay));
      delay *= 2;
    }
  }
}

/**
 * Récupère et enregistre le token courant pour un utilisateur (participants/{uid})
 * – respecte single-flight + cooldowns (RNFB Firestore).
 */
export async function registerCurrentFcmToken(uid, { force = false } = {}) {
  if (!uid) return null;

  const now = Date.now();

  // Cooldown après succès
  if (!force && _lastSuccessAt && now - _lastSuccessAt < SUCCESS_COOLDOWN_MS) {
    const cached = _lastOkToken || (await AsyncStorage.getItem(AS_KEY));
    if (cached) return cached;
  }

  // Cooloff après échec
  if (!force && _lastAttemptAt && now - _lastAttemptAt < ERROR_COOLdown_MS) {
    return _lastOkToken || (await AsyncStorage.getItem(AS_KEY));
  }

  _lastAttemptAt = now;

  // Single-flight
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) throw new Error('Notifications permission not granted');

      const tokenValue = await getExpoTokenWithRetry(4);
      if (!tokenValue) return _lastOkToken || (await AsyncStorage.getItem(AS_KEY));

      _lastOkToken = tokenValue;
      _lastSuccessAt = Date.now();

      const prev = await AsyncStorage.getItem(AS_KEY);
      if (prev !== tokenValue) {
        await AsyncStorage.setItem(AS_KEY, tokenValue);

        // === RNFB Firestore writes uniquement si changement ===
        const pRef = firestore().doc(`participants/${uid}`);
        const nowTs = firestore.FieldValue.serverTimestamp();

        await pRef.set(
          {
            fcmTokens: { [tokenValue]: true },
            updatedAt: nowTs,
            platform: Platform.OS,
          },
          { merge: true }
        );

        const tokenRef = firestore().doc(`participants/${uid}/fcm_tokens/${tokenValue}`);
        await tokenRef.set(
          {
            token: tokenValue,
            type: 'expo',
            updatedAt: nowTs,
            platform: Platform.OS,
          },
          { merge: true }
        );
      }

      return tokenValue;
    } catch (e) {
      console.log('[Push] token refresh failed:', e?.message || String(e));
      return _lastOkToken || (await AsyncStorage.getItem(AS_KEY));
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

/* ──────────────────────────────────────────────────────────────────────────
   Listener AppState → tente un refresh au retour actif
   ────────────────────────────────────────────────────────────────────────── */
let appStateSub;
export function startFcmTokenRefreshListener(uid) {
  stopFcmTokenRefreshListener();
  appStateSub = AppState.addEventListener('change', async (next) => {
    if (next === 'active' && uid) {
      await sleep(400);
      try {
        await registerCurrentFcmToken(uid);
      } catch (e) {
        console.log('[Push] refresh token on foreground failed:', e?.message || e);
      }
    }
  });
}

export function stopFcmTokenRefreshListener() {
  try { appStateSub?.remove?.(); } catch {}
  appStateSub = undefined;
}

/**
 * Désinscrire: supprime la clé côté Firestore et le cache local.
 */
export async function unregisterDeviceToken(uid) {
  try {
    const last = await AsyncStorage.getItem(AS_KEY);
    if (uid && last) {
      const pRef = firestore().doc(`participants/${uid}`);
      await pRef.set(
        {
          // suppression d’un champ imbriqué: utiliser la notation dot + FieldValue.delete()
          [`fcmTokens.${last}`]: firestore.FieldValue.delete(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await AsyncStorage.removeItem(AS_KEY);
  } catch {}
}