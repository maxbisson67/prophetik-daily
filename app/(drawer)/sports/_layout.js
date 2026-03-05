// app/(drawer)/sports/_layout.js
import React from "react";
import { Stack } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { useTheme } from "@src/theme/ThemeProvider";

export default function SportsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerBackTitleVisible: false,
      }}
    >
      {/* ✅ Hub = hamburger */}
      <Stack.Screen
        name="index"
        options={{
          title: "Sports",
          headerLeft: () => <DrawerToggleButton tintColor={colors.text} />,
        }}
      />

      {/* ✅ Sous-pages = back automatique (ne mets PAS headerLeft ici) */}
      <Stack.Screen name="MatchLiveScreen" options={{ title: "Match Live" }} />
      <Stack.Screen name="NhlStandingsScreen" options={{ title: "Classement NHL" }} />
      <Stack.Screen name="NhlScheduleScreen" options={{ title: "Calendrier" }} />
      <Stack.Screen name="MlbComingSoon" options={{ title: "MLB" }} />
    </Stack>
  );
}