// app/(auth)/_layout.js
import { Stack } from "expo-router";
import i18n from "@src/i18n/i18n";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="auth-choice"
        options={{
          title: i18n.t("auth.choice.title", { defaultValue: "Connexion" }),
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="phone-login"
        options={{
          title: i18n.t("auth.phoneLogin.title", { defaultValue: "Continuer par SMS" }),
        }}
      />
      <Stack.Screen
        name="phone-signup"
        options={{
          title: i18n.t("auth.phoneSignup.title", { defaultValue: "Créer un compte" }),
        }}
      />
      <Stack.Screen name="sign-in" options={{ title: "Se connecter" }} />
      <Stack.Screen name="sign-up" options={{ title: "Créer un compte" }} />
    </Stack>
  );
}
