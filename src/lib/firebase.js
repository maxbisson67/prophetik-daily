// src/lib/firebase.js
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { initializeApp, getApps, getApp } from 'firebase/app';

// Web Auth SDK (utilisée uniquement comme "bridge" pour que Firestore Web récupère un token)
// ⚠️ On n’exporte PAS `auth` ici pour éviter tout mauvais usage côté natif.
import {
  getAuth as getWebAuth,
  initializeAuth as initializeWebAuth,
  getReactNativePersistence as getRNPersistenceAuth,
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
  enableNetwork
} from 'firebase/firestore';

import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔥 Logs Firestore verbeux en dev
if (__DEV__) {
  setLogLevel('silent'); // 'debug' | 'error' | 'silent'
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

/* ----------------------- webAuth (bridge only) -----------------------
   On initialise `webAuth` même sur natif pour que le Web SDK Firestore
   puisse récupérer le token via cette instance (persistance AsyncStorage).
   👉 Ne pas utiliser `webAuth` pour l’UI d’auth sur natif : on utilise RNFB Auth.
----------------------------------------------------------------------- */
export const webAuth = (() => {
  try {
    return initializeWebAuth(app, { persistence: getRNPersistenceAuth(AsyncStorage) });
  } catch {
    // déjà initialisée
    return getWebAuth(app);
  }
})();

/* ----------------------- Firestore ----------------------- */
function createDb() {
  try {
    // IMPORTANT: Firestore est initialisé APRÈS webAuth pour que le token
    // soit bien pris en compte par le Web SDK.
    const baseOpts = {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    };

    let opts = { ...baseOpts };

    if (Platform.OS === 'web' && typeof persistentLocalCache === 'function' && typeof persistentMultipleTabManager === 'function') {
      // Web: cache persistant + multi-onglets
      opts.localCache = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
    } else if (typeof memoryLocalCache === 'function') {
      // Natif: cache en mémoire pour éviter des états périmés au boot
      opts.localCache = memoryLocalCache();
    }

    return initializeFirestore(app, opts);
  } catch {
    const db = getFirestore(app);
    try {
      // @ts-ignore (selon versions)
      if (!db._settingsFrozen && typeof db.settings === 'function') {
        db.settings({ experimentalAutoDetectLongPolling: true, useFetchStreams: false });
      }
    } catch {}
    return db;
  }
}
export const db = createDb();


try {
  enableNetwork(db)
    .then(() => console.log('[Firestore] Réseau activé manuellement'))
    .catch((e) => console.warn('[Firestore] enableNetwork error', e));
} catch {}

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
  // RNFB (natif)
  try {
    const rnfbAuth = require('@react-native-firebase/auth').default;
    const u = rnfbAuth()?.currentUser;
    if (u?.uid) return u.uid;
  } catch {}

  // Web Auth (bridge)
  try {
    const u2 = getWebAuth(app)?.currentUser;
    if (u2?.uid) return u2.uid;
  } catch {}

  return null;
}

/**
 * Probe simple pour vérifier lecture de quelques documents
 */
/*export async function runFirestoreProbe({ groupId, defiId } = {}) {
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
}*/



export default { app, db, functions, storage, enableFirestoreDebugLogs,  webAuth };