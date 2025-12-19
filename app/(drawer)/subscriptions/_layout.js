// app/(drawer)/howitworks/_layout.js
import React from "react";
import { Stack } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

export default function SubscriptionsLayout() {
  const { colors } = useTheme();

  const title = i18n.t("subscriptions.headerTitle", {
    defaultValue: "Abonnement",
  });

  return (
    <Stack
      screenOptions={{
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