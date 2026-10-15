// app/(drawer)/(tabs)/_layout.js
import React, { useMemo } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import i18n from "@src/i18n/i18n";

import { useTheme } from "@src/theme/ThemeProvider";
import { useLiveTabTitle } from "@src/groups/SelectedGroupProvider";

const TAB_ACTIVE_BAR = { width: 22, height: 3, marginTop: 2, marginBottom: 5, borderRadius: 2 };

function TabIconWithActiveBar({ focused, children }) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: "center" }}>
      {children}
      <View
        style={{
          ...TAB_ACTIVE_BAR,
          backgroundColor: focused ? colors.primary : "transparent",
        }}
      />
    </View>
  );
}

function TabBarButton(props) {
  const { isDark } = useTheme();
  const selected = props.accessibilityState?.selected;

  const activeBackground = isDark ? "rgba(239, 68, 68, 0.24)" : "rgba(239, 68, 68, 0.14)";
  const ripple = isDark ? "rgba(239, 68, 68, 0.18)" : "rgba(239, 68, 68, 0.12)";

  return (
    <Pressable
      {...props}
      android_ripple={{ color: ripple, borderless: false }}
      style={({ pressed }) => [
        props.style,
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          marginHorizontal: 3,
          marginVertical: 5,
          backgroundColor: selected ? activeBackground : "transparent",
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    />
  );
}

function TabBarLabel({ focused, children }) {
  const { colors } = useTheme();
  const labelColor = focused ? colors.primary : colors.subtext;

  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      style={{
        color: labelColor,
        fontSize: 10,
        fontWeight: focused ? "800" : "600",
        textAlign: "center",
        marginTop: 1,
      }}
    >
      {children}
    </Text>
  );
}

function TabsLayoutInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const liveTabTitle = useLiveTabTitle();

  const tabBarBottomPad = Platform.OS === "ios" ? Math.max(insets.bottom, 10) : 8;

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      lazy: true,
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text },
      tabBarStyle: {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        paddingTop: 6,
        paddingBottom: tabBarBottomPad,
        paddingHorizontal: 2,
        minHeight: 52 + tabBarBottomPad,
      },
      tabBarItemStyle: {
        paddingVertical: 0,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.subtext,
      tabBarButton: (props) => <TabBarButton {...props} />,
      tabBarLabel: (props) => <TabBarLabel {...props} />,
    }),
    [colors.card, colors.border, colors.primary, colors.subtext, colors.text, tabBarBottomPad]
  );

  return (
    <View style={{ flex: 1 }}>
      <Tabs initialRouteName="AccueilScreen" screenOptions={screenOptions}>
        <Tabs.Screen
          name="AccueilScreen"
          options={{
            title: i18n.t("home.title", { defaultValue: "Aujourd’hui" }),
            headerLeft: (props) => <DrawerToggleButton {...props} />,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithActiveBar focused={focused}>
                <Ionicons
                  name={focused ? "calendar" : "calendar-outline"}
                  color={color}
                  size={size}
                />
              </TabIconWithActiveBar>
            ),
          }}
        />

        <Tabs.Screen
          name="LiveScreen"
          options={{
            title: liveTabTitle,
            tabBarLabel: liveTabTitle,
            headerLeft: (props) => <DrawerToggleButton {...props} />,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithActiveBar focused={focused}>
                <MaterialCommunityIcons
                  name="satellite-uplink"
                  color={color}
                  size={focused ? size + 2 : size}
                />
              </TabIconWithActiveBar>
            ),
          }}
        />

        <Tabs.Screen
          name="ChallengesScreen"
          options={{
            title: i18n.t("tabs.challenges", { defaultValue: "Historique" }),
            tabBarLabel: i18n.t("tabs.challenges", { defaultValue: "Historique" }),
            headerLeft: (props) => <DrawerToggleButton {...props} />,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithActiveBar focused={focused}>
                <Ionicons name={focused ? "time" : "time-outline"} color={color} size={size} />
              </TabIconWithActiveBar>
            ),
          }}
        />

        <Tabs.Screen
          name="ClassementScreen"
          options={{
            title: i18n.t("tabs.leaderboard", { defaultValue: "Classement" }),
            headerLeft: (props) => <DrawerToggleButton {...props} />,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIconWithActiveBar focused={focused}>
                <Ionicons
                  name={focused ? "podium" : "podium-outline"}
                  color={color}
                  size={focused ? size + 1 : size}
                />
              </TabIconWithActiveBar>
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
