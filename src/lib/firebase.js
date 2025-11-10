// src/lib/firebase.js
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { initializeApp, getApps, getApp } from 'firebase/app';

// Web Auth SDK (sur natif on utilise initializeAuth RN + AsyncStorage comme persistance)
import {
  getAuth as getWebAuth,
  initializeAuth as initializeWebAuth,
  getReactNativePersistence as getRNPersistenceAuth,
  signOut as webSignOut,
} from 'firebase/auth';

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDoc,
} from 'firebase/firestore';

import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔥 Verbose Firestore logs en dev
if (__DEV__) {
  setLogLevel('debug');
}

/* ----------------------- Config ----------------------- */
const cfg =
  Constants.expoConfig?.extra?.firebase ??
  Constants.manifest?.extra?.firebase ??
  {};

const firebaseConfig = {
  apiKey: cfg.apiKey,
  authDomain: cfg.authDomain,
  databaseURL: cfg.databaseURL,
  projectId: cfg.projectId,
  storageBucket: cfg.storageBucket || 'capitaine.appspot.com',
  messagingSenderId: cfg.messagingSenderId,
  appId: cfg.appId,
  measurementId: cfg.measurementId,
};

/* ----------------------- App ----------------------- */
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/* ----------------------- Storage ----------------------- */
export const storage = getStorage(app);

/* ----------------------- Auth (web only) -----------------------
   Sur natif, on n’utilise PAS firebase/auth pour l’UI — c’est RNFB Auth.
   MAIS on initialise quand même une instance "webAuth" pour que Firestore
   récupère le token (le Web SDK Firestore s’accroche à l’Auth du même app).
------------------------------------------------------------------ */

// Ancien export `auth` (web uniquement). Sur natif il reste `null`.
export const auth = (() => {
  if (Platform.OS === 'web') {
    try {
      return getWebAuth(app);
    } catch {
      return getWebAuth(app);
    }
  }
  return null;
})();

// 👉 IMPORTANT: Initialiser ici une instance d’auth compatible RN (même sur natif),
// AVANT d’initialiser Firestore, pour que Firestore reçoive bien le user.
export const webAuth = (() => {
  try {
    // use React Native persistence (AsyncStorage) sur iOS/Android
    return initializeWebAuth(app, { persistence: getRNPersistenceAuth(AsyncStorage) });
  } catch {
    // si déjà initialisé
    return getWebAuth(app);
  }
})();

/* ----------------------- Firestore ----------------------- */
function createDb() {
  try {
    const baseOpts = {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    };

    let opts = { ...baseOpts };

    if (Platform.OS === 'web' && typeof persistentLocalCache === 'function' && typeof persistentMultipleTabManager === 'function') {
      opts.localCache = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
    } else if (typeof memoryLocalCache === 'function') {
      // Natif: cache en mémoire pour éviter l’AsyncStorage et les données périmées au boot
      opts.localCache = memoryLocalCache();
    }

    // ⚠️ Firestore est initialisé APRÈS webAuth → il pourra s’abonner aux changements d’auth
    return initializeFirestore(app, opts);
  } catch {
    const db = getFirestore(app);
    try {
      // @ts-ignore selon versions SDK
      if (!db._settingsFrozen && typeof db.settings === 'function') {
        db.settings({ experimentalAutoDetectLongPolling: true, useFetchStreams: false });
      }
    } catch {}
    return db;
  }
}
export const db = createDb();

/* ----------------------- Functions ----------------------- */
export const functions = getFunctions(app, 'us-central1');

/* ----------------------- Helpers Debug (opt-in) ----------------------- */
export function enableFirestoreDebugLogs() {
  // if (__DEV__) setLogLevel('debug');
}

/**
 * UID courant: tente RNFB Auth (natif), sinon firebase/auth.
 */
function getCurrentUidSafe() {
  try {
    const rnfbAuth = require('@react-native-firebase/auth').default;
    const u = rnfbAuth()?.currentUser;
    if (u?.uid) return u.uid;
  } catch {}

  try {
    const u2 = getWebAuth(app)?.currentUser;
    if (u2?.uid) return u2.uid;
  } catch {}

  return null;
}

/**
 * Petit probe pour diagnostiquer l’accès à quelques docs.
 */
export async function runFirestoreProbe({ groupId, defiId } = {}) {
  try {
    const uid = getCurrentUidSafe();
    if (!uid) {
      console.log('[Probe] Aucun utilisateur connecté (uid introuvable).');
      return;
    }
    console.log('[Probe] UID:', uid);

    if (groupId) {
      const mRef = doc(db, 'group_memberships', `${groupId}_${uid}`);
      try {
        const mSnap = await getDoc(mRef);
        console.log('[Probe] membership path:', mRef.path, 'exists:', mSnap.exists());
      } catch (e) {
        console.warn('[Probe] membership error:', e);
      }
    }

    if (defiId) {
      const dRef = doc(db, 'defis', String(defiId));
      try {
        const dSnap = await getDoc(dRef);
        console.log('[Probe] defi path:', dRef.path, 'exists:', dSnap.exists());
      } catch (e) {
        console.warn('[Probe] defi error:', e);
      }
    }
  } catch (e) {
    console.warn('[Probe] global error:', e);
  }
}

/* ----------------------- Diag init (ordre correct) ----------------------- */
try {
  console.log(
    '[Firebase DEBUG] db.app.projectId =', db?.app?.options?.projectId,
    '| webAuth.app.projectId =', webAuth?.app?.options?.projectId,
    '| app.name =', app?.name
  );
} catch (e) {
  console.warn('[Firebase DEBUG] Impossible de logguer le projectId', e);
}

export default { app, auth, db, functions, storage, enableFirestoreDebugLogs, runFirestoreProbe, webAuth };