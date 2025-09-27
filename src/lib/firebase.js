// src/lib/firebase.js
import { Platform } from 'react-native';
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from "firebase/storage";

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const cfg = Constants.expoConfig?.extra?.firebase ?? {};

// 🔎 Ajoute une petite validation pour repérer vite les undefined
function must(name, val) {
  if (!val) throw new Error(`Firebase config manquante: ${name} est vide/undefined`);
  return val;
}

// ⚠️ tes valeurs ici
const firebaseConfig = {
apiKey: cfg.apiKey,
  authDomain: cfg.authDomain,
  databaseURL: cfg.databaseURL,
  projectId: cfg.projectId,
  storageBucket: cfg.storageBucket,
  messagingSenderId: cfg.messagingSenderId,
  appId: cfg.appId,
  measurementId: cfg.measurementId
};

// 1) App singleton
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 2) Auth avec persistance adaptée (web vs natif)
let auth;
if (Platform.OS === 'web') {
  // Sur web, la persistance par défaut convient
  auth = getAuth(app);
} else {
  // Sur iOS/Android (Expo/React Native), utiliser AsyncStorage
  // initializeAuth doit être appelé AVANT tout getAuth(app)
  try {
    // Si déjà initialisé ailleurs, ceci lèvera rarement; on essaye d'abord initializeAuth
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Si déjà initialisé, on récupère l'instance
    auth = getAuth(app);
  }
}

const db = getFirestore(app);
// ⚠️ Mets la même région que tes Cloud Functions (us-central1 par défaut)
const functions = getFunctions(app, 'us-central1');
=const storage = getStorage(app);
export { app, auth, db, functions, storage };