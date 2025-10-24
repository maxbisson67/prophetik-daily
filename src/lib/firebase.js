// src/lib/firebase.js
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { initializeApp, getApp, getApps } from 'firebase/app';

import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';

import {
  getFirestore,
  // Ces APIs peuvent ne pas exister selon la version de `firebase`
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache, 
} from 'firebase/firestore';

import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
// Le 2e param (bucket) est optionnel si `storageBucket` est dans la config
export const storage = getStorage(app);

/* ----------------------- Auth (RN/Expo) ----------------------- */
export const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    // IMPORTANT: initializeAuth avant tout getAuth(app)
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Si déjà initialisé
    return getAuth(app);
  }
})();

/* ----------------------- Firestore ----------------------- */
// Fallback robuste : préfère initializeFirestore (options dès l'init),
// sinon retombe sur getFirestore + tentative de settings.
function createDb() {
  try {
    if (typeof initializeFirestore === 'function') {
      // Options réseau sûres pour RN/Expo
      const baseOpts = {
        experimentalAutoDetectLongPolling: true,
        useFetchStreams: false,
      };

      // Cache persistant si dispo dans la version du SDK
       let opts = { ...baseOpts };
      if (isWeb && typeof persistentLocalCache === 'function' && typeof persistentMultipleTabManager === 'function') {
        opts.localCache = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
      } else if (typeof memoryLocalCache === 'function') {
        opts.localCache = memoryLocalCache(); // 👈 évite le warning en RN
      }

      return initializeFirestore(app, opts);
    }

    // Anciennes versions
    const db = getFirestore(app);
    try {
      // Certaines versions permettent encore d'appeler settings()
      // @ts-ignore interne / selon versions
      if (!db._settingsFrozen && typeof db.settings === 'function') {
        db.settings({
          experimentalAutoDetectLongPolling: true,
          useFetchStreams: false,
        });
      }
    } catch {
      // ignore
    }
    return db;
  } catch {
    // Si initializeFirestore a déjà été appelé autre part
    return getFirestore(app);
  }
}
export const db = createDb();

/* ----------------------- Functions ----------------------- */
// Mets la même région que tes Cloud Functions
export const functions = getFunctions(app, 'us-central1');

/* ----------------------- Exports groupés ----------------------- */
export default { app, auth, db, functions, storage };