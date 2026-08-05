// app/(drawer)/(tabs)/_layout.js
import React, { useMemo } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

import { useTheme } from "@src/theme/ThemeProvider";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useMyGroups } from "@src/groups/MyGroupsProvider";
import {
  useLiveTabTitle,
  useSelectedGroup,
} from "@src/groups/SelectedGroupProvider";
import { useGroupsUnreadTotal } from "@src/groupChat/useGroupUnreadCount";

function TabsLayoutInner() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { groupIds } = useMyGroups();
  const { selectedGroupId, selectedSport } = useSelectedGroup();
  const groupChatUnread = useGroupsUnreadTotal(groupIds, user?.uid);

  const liveTabTitle = useLiveTabTitle();

  const todayTabBadge = useMemo(() => {
    if (!groupChatUnread || groupChatUnread <= 0) return undefined;
    return groupChatUnread > 99 ? "99+" : groupChatUnread;
  }, [groupChatUnread]);

  return (
    <View style={{ flex: 1 }}>
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
              <Ionicons name="calendar-outline" color={color} size={size} />
            ),
            tabBarBadge: todayTabBadge,
            tabBarBadgeStyle: {
              backgroundColor: "#ef4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: "800",
              minWidth: 18,
              height: 18,
              lineHeight: 18,
            },
          }}
        />

        <Tabs.Screen
          name="LiveScreen"
          options={{
            title: liveTabTitle,
            tabBarLabel: liveTabTitle,
            headerLeft: (props) => <DrawerToggleButton {...props} />,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="broadcast" color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="ChallengesScreen"
          options={{
            title: i18n.t("tabs.challenges", { defaultValue: "Historique" }),
            tabBarLabel: i18n.t("tabs.challenges", { defaultValue: "Historique" }),
            headerLeft: (props) => <DrawerToggleButton {...props} />,
            tabBarActiveTintColor: "#16a34a",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" color={color} size={size} />
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

        <Tabs.Screen name="BadgesScreen" options={{ href: null }} />

        <Tabs.Screen
          name="GroupsScreen"
          options={{
            href: null,
            title: i18n.t("groups.title", { defaultValue: "Mes groupes" }),
            headerLeft: (props) => <DrawerToggleButton {...props} />,
          }}
        />
        <Tabs.Screen name="sports" options={{ href: null }} />
        <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      </Tabs>
    </View>
  );
}

export default function TabsLayout() {
  return <TabsLayoutInner />;
}
