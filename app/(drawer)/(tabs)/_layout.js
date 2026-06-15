// app/(drawer)/(tabs)/_layout.js
import React from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import TabBadge from "@src/ui/TabBadge";

import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useEligibleChallengesCount } from "@src/hooks/useEligibleChallengesCount";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const eligibleCount = useEligibleChallengesCount({ userUid: user?.uid });

  return (
    <Tabs
      initialRouteName="AccueilScreen"
      screenOptions={{
        headerShown: true,
        lazy: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
      }}
    >
      <Tabs.Screen
        name="AccueilScreen"
        options={{
          title: i18n.t("home.title", { defaultValue: "Aujourd’hui" }),
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-outline" color={color} size={size} />
              <TabBadge value={eligibleCount} colors={colors} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="ChallengesScreen"
        options={{
          title: i18n.t("tabs.challenges", { defaultValue: "Mes résultats" }),
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="ClassementScreen"
        options={{
          title: i18n.t("tabs.leaderboard", { defaultValue: "Classement" }),
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="podium" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen name="GroupsScreen" options={{ href: null }} />
      <Tabs.Screen name="sports" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}