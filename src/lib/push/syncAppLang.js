import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";

function normalizeAppLang(value) {
  return String(value || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

export async function readStoredAppLang() {
  try {
    const saved = await AsyncStorage.getItem("appLang");
    return normalizeAppLang(saved || "fr");
  } catch {
    return "fr";
  }
}

export async function syncAppLangToFirestore(uid) {
  const userId = String(uid || "").trim();
  if (!userId) return null;

  const appLang = await readStoredAppLang();

  await firestore()
    .doc(`participants/${userId}`)
    .set(
      {
        appLang,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return appLang;
}
