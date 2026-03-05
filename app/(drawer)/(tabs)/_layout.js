// app/(drawer)/(tabs)/_layout.js
import React from "react";
import {View} from 'react-native';
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import TabBadge from "@src/ui/TabBadge";

import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useEligibleChallengesCount} from "@src/hooks/useEligibleChallengesCount";


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
          title: i18n.t("tabs.home", { defaultValue: "Home" }),
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="GroupsScreen"
        options={{
          title: i18n.t("tabs.groups", { defaultValue: "Groups" }),
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="ChallengesScreen"
        options={{
          title: i18n.t("tabs.challenges", { defaultValue: "Challenges" }),
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ size }) => (
          <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <ProphetikIcons mode="emoji" emoji="🎯" size={size >= 28 ? "lg" : "md"} iconOnly />
            <TabBadge value={eligibleCount} colors={colors} />
          </View>
          ),
        }}
      />

      <Tabs.Screen
        name="ClassementScreen"
        options={{
          title: i18n.t("tabs.leaderboard", { defaultValue: "Leaderboard" }),
          headerLeft: (props) => <DrawerToggleButton {...props} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="podium" color={color} size={size} />
          ),
        }}
      />


    <Tabs.Screen
      name="sports"
      options={{
        title: i18n.t("drawer.sports", { defaultValue: "Sports" }),
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="radio-outline" size={size} color={color} />
        ),
      }}
    />

      {/* Route index masquée */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}