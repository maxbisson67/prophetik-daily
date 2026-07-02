// app/firebaseauth/link.js
import { useEffect } from "react";
import { useRouter, useRootNavigationState } from "expo-router";
import { ActivityIndicator, View, Text } from "react-native";
import { useAuth } from "@src/auth/SafeAuthProvider";

export default function FirebaseAuthLink() {
  const router = useRouter();
  const rootState = useRootNavigationState();
  const navReady = !!rootState?.key;
  const { user, ready: authReady } = useAuth();

  useEffect(() => {
    if (!navReady || !authReady) return;

    const timer = setTimeout(() => {
      try {
        if (router.canGoBack?.()) {
          router.back();
          return;
        }

        if (user?.uid) {
          router.replace("/(drawer)/(tabs)/AccueilScreen");
        } else {
          router.replace("/(auth)/auth-choice");
        }
      } catch (e) {
        console.warn("[firebaseauth/link] navigation failed", e?.message || e);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [navReady, authReady, router, user?.uid]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 10 }}>Traitement du lien…</Text>
    </View>
  );
}
