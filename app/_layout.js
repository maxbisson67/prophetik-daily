// app/_layout.js
// app/_layout.js
import React, { useEffect } from "react";
import { ImageBackground, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@src/auth/AuthProvider";


function AuthGate({ children }) {
  const router = useRouter();
  const segments = useSegments();
  const rootState = useRootNavigationState();     // <- état du routeur racine
  const navReady = !!rootState?.key;              // prêt quand une clé existe

  const { user, ready: authReady } = useAuth();   // expose { user, ready } dans ton AuthProvider

  useEffect(() => {
    if (!authReady || !navReady) return;          // on attend les deux
    const inAuthFlow = segments[0] === "(auth)";

    if (!user && !inAuthFlow) {
      router.replace("/(auth)/auth-choice");      // non connecté -> auth
    } else if (user && inAuthFlow) {
      router.replace("/(tabs)");                  // connecté -> onglets
    }
  }, [authReady, navReady, user, segments, router]);

  // Important: toujours rendre les enfants; pas de navigation avant montage
  return children;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ImageBackground
          source={require("../assets/gradient-back.jpeg")}
          style={styles.bg}
          resizeMode="cover"
        >
          <AuthGate>
          <Stack
            screenOptions={{
              // Le contenu hérite du fond (transparent)
              contentStyle: { backgroundColor: "transparent" },
              // Le header reste opaque (blanc ici)
              headerStyle: { backgroundColor: "#fff" },
              headerShadowVisible: true, // petite ligne de séparation (iOS)
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="profile/index" options={{ title: "Profil" }} />
            <Stack.Screen name="groups" options={{ headerShown: false }} />
          </Stack>
          </AuthGate>
        </ImageBackground>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});