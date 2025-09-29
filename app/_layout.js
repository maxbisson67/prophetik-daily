// app/_layout.js
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
// ⚠️ AuthProvider doit envelopper tout le Stack
import { AuthProvider } from "@src/auth/AuthProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack>
          {/* Masque complètement le header pour le groupe d’onglets */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />

          {/* Écrans hors onglets (exemples) */}
          <Stack.Screen name="profile/index" options={{ title: "Profil" }} />
          <Stack.Screen name="groups" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}