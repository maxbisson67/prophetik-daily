// app/(drawer)/subscriptions/_layout.js
import React, { useMemo } from "react";
import { Stack } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { useTheme } from "@src/theme/ThemeProvider";
import { useLanguage } from "@src/i18n/LanguageProvider";
import i18n from "@src/i18n/i18n";

export default function SubscriptionsLayout() {
  const { colors } = useTheme();
  const { lang } = useLanguage(); // 👈 déclenche un re-render

  const title = useMemo(
    () =>
      i18n.t("subscriptions.title", {
        defaultValue: "Forfaits Prophetik",
      }),
    [lang] // 👈 clé magique
  );

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        title,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}