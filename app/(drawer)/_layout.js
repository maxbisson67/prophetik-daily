// app/(drawer)/_layout.js
import React, { useCallback, useMemo } from "react";
import { View, Text, Image } from "react-native";
import { Drawer } from "expo-router/drawer";
import {
  DrawerToggleButton,
  DrawerContentScrollView,
  DrawerItem,
} from "@react-navigation/drawer";
import {
  getFocusedRouteNameFromRoute,
  DrawerActions,
} from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import { usePublicProfile } from "@src/profile/usePublicProfile";
import useMeDoc from "@src/home/hooks/useMeDoc";
import i18n from "@src/i18n/i18n";

/* =========================================================
   Helpers
========================================================= */

function getHeaderTitle(route) {
  const focused = getFocusedRouteNameFromRoute(route) ?? "AccueilScreen";

  switch (focused) {
    case "AccueilScreen":
    case "index":
      return i18n.t("tabs.today", { defaultValue: "Aujourd’hui" });

    case "ChallengesScreen":
      return i18n.t("tabs.challenges", { defaultValue: "Mes résultats" });

    case "ClassementScreen":
      return i18n.t("tabs.leaderboard", { defaultValue: "Classement" });

    case "GroupsScreen":
      return i18n.t("drawer.groups", { defaultValue: "Mes groupes" });

    case "profile/index":
      return i18n.t("drawer.profile", { defaultValue: "Mon profil" });

    case "settings/index":
      return i18n.t("drawer.settings", { defaultValue: "Paramètres" });

    case "sports/nhl-live":
      return i18n.t("drawer.nhlLive", { defaultValue: "NHL Live" });

    case "sports/mlb-live":
      return i18n.t("drawer.mlbLive", { defaultValue: "MLB Live" });

    default:
      return i18n.t("app.name", { defaultValue: "Prophetik" });
  }
}

function SectionLabel({ children }) {
  const { colors } = useTheme();

  return (
    <Text
      style={{
        marginTop: 18,
        marginBottom: 6,
        marginHorizontal: 16,
        color: colors.subtext,
        fontWeight: "700",
      }}
    >
      {children}
    </Text>
  );
}

function Separator() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
        marginHorizontal: 12,
      }}
    />
  );
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();

  if (typeof ts.seconds === "number") {
    return ts.seconds * 1000 + (ts.nanoseconds ? Math.floor(ts.nanoseconds / 1e6) : 0);
  }

  if (typeof ts === "number") return ts;

  return 0;
}

function withCacheBust(url, updatedAt) {
  if (!url) return null;

  const v = tsToMillis(updatedAt) || Date.now();
  return url.includes("?") ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

/* =========================================================
   DrawerHeader
========================================================= */

function DrawerHeader() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const { profile: pub, loading: loadingPub } = usePublicProfile(user?.uid);
  const { meDoc, loading: loadingMe } = useMeDoc({
    authReady: true,
    uid: user?.uid,
    dayTick: 0,
  });

  const [avatarFailed, setAvatarFailed] = React.useState(false);

  const guestLabel = i18n.t("drawer.guest", { defaultValue: "Guest" });
  const onlineLabel = i18n.t("drawer.online", { defaultValue: "Signed in" });
  const offlineLabel = i18n.t("drawer.offline", { defaultValue: "Offline" });
  const loadingLabel = i18n.t("common.loading", { defaultValue: "Loading…" });

  const displayName =
    meDoc?.displayName ||
    pub?.displayName ||
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : guestLabel);

  const email = user?.email || "";

  const rawAvatar = meDoc?.avatarUrl || pub?.avatarUrl || user?.photoURL || null;
  const avatarUpdatedAt = meDoc?.updatedAt || pub?.updatedAt || null;

  const avatarUri = useMemo(
    () => withCacheBust(rawAvatar, avatarUpdatedAt),
    [rawAvatar, avatarUpdatedAt]
  );

  React.useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUri]);

  const avatarSource =
    avatarFailed || !avatarUri
      ? require("@src/assets/avatar-placeholder.png")
      : { uri: avatarUri };

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Image
        source={avatarSource}
        onError={() => {
          setAvatarFailed(true);
        }}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.card,
        }}
      />

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
          {loadingPub || loadingMe ? loadingLabel : displayName}
        </Text>

        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {email || (user ? onlineLabel : offlineLabel)}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   Drawer Content
========================================================= */

function CustomDrawerContent(props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();

  const goTab = useCallback(
    (screenName) => {
      props.navigation.navigate("(tabs)", { screen: screenName });
      props.navigation.dispatch(DrawerActions.closeDrawer());
    },
    [props.navigation]
  );

  const closeAndPush = useCallback(
    (path) => {
      props.navigation.dispatch(DrawerActions.closeDrawer());
      requestAnimationFrame(() => router.push(path));
    },
    [props.navigation, router]
  );

  const itemCommonProps = {
    style: { marginHorizontal: 4, borderRadius: 10 },
    labelStyle: { color: colors.text, fontWeight: "600" },
    activeTintColor: colors.primary,
    inactiveTintColor: colors.subtext,
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ paddingTop: 0 }}
      style={{ backgroundColor: colors.background }}
    >
      <DrawerHeader />
      <Separator />

      <SectionLabel>
        {i18n.t("drawer.section.navigation", { defaultValue: "Navigation" })}
      </SectionLabel>

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("tabs.today", { defaultValue: "Aujourd’hui" })}
        onPress={() => goTab("AccueilScreen")}
        icon={({ size }) => (
          <Ionicons name="calendar-outline" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("tabs.challenges", { defaultValue: "Mes résultats" })}
        onPress={() => goTab("ChallengesScreen")}
        icon={({ size }) => (
          <Ionicons name="stats-chart-outline" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("tabs.leaderboard", { defaultValue: "Classement" })}
        onPress={() => goTab("ClassementScreen")}
        icon={({ size }) => (
          <Ionicons name="podium-outline" size={size} color={colors.text} />
        )}
      />

      <Separator />

      <SectionLabel>
        {i18n.t("drawer.section.personal", { defaultValue: "Personnel" })}
      </SectionLabel>

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("drawer.profile", { defaultValue: "Mon profil" })}
        onPress={() => closeAndPush("/(drawer)/profile")}
        icon={({ size }) => (
          <Ionicons name="person-circle-outline" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("drawer.groups", { defaultValue: "Mes groupes" })}
        onPress={() => goTab("GroupsScreen")}
        icon={({ size }) => (
          <Ionicons name="people-outline" size={size} color={colors.text} />
        )}
      />

      <Separator />

      <SectionLabel>
        {i18n.t("drawer.section.liveSports", { defaultValue: "Sports live" })}
      </SectionLabel>

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("drawer.nhlLive", { defaultValue: "NHL Live" })}
        onPress={() => closeAndPush("/(drawer)/sports/nhl-live")}
        icon={({ size }) => (
          <MaterialCommunityIcons name="hockey-sticks" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("drawer.mlbLive", { defaultValue: "MLB Live" })}
        onPress={() => closeAndPush("/(drawer)/sports/mlb-live")}
        icon={({ size }) => (
          <MaterialCommunityIcons name="baseball" size={size} color={colors.text} />
        )}
      />

      <Separator />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("drawer.settings", { defaultValue: "Paramètres" })}
        onPress={() => closeAndPush("/(drawer)/settings")}
        icon={({ size }) => (
          <Ionicons name="settings-outline" size={size} color={colors.text} />
        )}
      />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("tabs.help", { defaultValue: "Aide" })}
        onPress={() => closeAndPush("/(drawer)/howitworks")}
        icon={({ size }) => (
          <Ionicons name="help-circle-outline" size={size} color={colors.text} />
        )}
      />

      <Separator />

      <DrawerItem
        {...itemCommonProps}
        label={i18n.t("drawer.signOut", { defaultValue: "Déconnexion" })}
        onPress={async () => {
          await signOut().catch(() => {});
          router.replace("/(auth)/auth-choice");
        }}
        icon={({ size }) => (
          <Ionicons name="log-out-outline" size={size} color={colors.text} />
        )}
      />
    </DrawerContentScrollView>
  );
}

/* =========================================================
   Drawer Layout
========================================================= */

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <Drawer
      id="rootDrawer"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        drawerHideStatusBarOnOpen: true,
        headerLeft: (props) => <DrawerToggleButton {...props} />,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        drawerStyle: { backgroundColor: colors.background },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.subtext,
        drawerLabelStyle: { fontWeight: "700" },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={({ route }) => ({
          drawerLabel: i18n.t("drawer.home", { defaultValue: "Prophetik" }),
          headerTitle: getHeaderTitle(route),
        })}
      />

      <Drawer.Screen
        name="sports/nhl-live"
        options={{
          drawerLabel: i18n.t("drawer.nhlLive", { defaultValue: "NHL Live" }),
          headerTitle: i18n.t("drawer.nhlLive", { defaultValue: "NHL Live" }),
        }}
      />

      <Drawer.Screen
        name="sports/mlb-live"
        options={{
          drawerLabel: i18n.t("drawer.mlbLive", { defaultValue: "MLB Live" }),
          headerTitle: i18n.t("drawer.mlbLive", { defaultValue: "MLB Live" }),
        }}
      />
    </Drawer>
  );
}