// @src/dev/hardReset.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

export async function hardResetAll() {
  try {
    // 1) Sign out Firebase Auth (efface les creds natives)
    await auth().signOut();
  } catch (e) {
    console.log('[hardReset] signOut error:', e?.message || String(e));
  }

  try {
    // 2) Vider TOUT l’AsyncStorage (tokens, flags maison, etc.)
    await AsyncStorage.clear();
  } catch (e) {
    console.log('[hardReset] AsyncStorage.clear error:', e?.message || String(e));
  }

  // 3) (optionnel) redémarrer l’app ou renvoyer à l’écran d’auth
  // e.g. router.replace('/(auth)/auth-choice');
}