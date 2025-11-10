// src/lib/firebaseAuthClient.js
import { getAuth, initializeAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
// ❌ supprime cette ligne qui casse:
// import { getReactNativePersistence } from "firebase/auth/react-native";
import { getReactNativePersistence } from "./rnPersistence"; // ✅ notre adaptateur local
import { app } from "./firebase";

let authInstance;

export function getReactNativeAuth() {
  if (authInstance) return authInstance;
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    authInstance = getAuth(app);
  }
  return authInstance;
}