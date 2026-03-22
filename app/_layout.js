// app/_layout.js
import React, { useEffect, useState, useRef } from "react";
import "../app/_prelude";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { ImageBackground, StyleSheet, Animated, Easing, Platform } from "react-native";
import {
  Stack,
  useRouter,
  useRootNavigationState,
  usePathname,
  useSegments,
} from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@src/auth/SafeAuthProvider";
import { AppVisibilityProvider } from "@src/providers/AppVisibilityProvider";
import "@src/lib/safeAsyncStorage";
import { ThemeProvider, useTheme } from "@src/theme/ThemeProvider";
import { LanguageProvider } from "@src/i18n/LanguageProvider";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import {
  attachNotificationListeners,
  registerCurrentFcmToken,
  startFcmTokenRefreshListener,
  stopFcmTokenRefreshListener,
} from "@src/lib/push/registerFcmToken";
import { setupNotificationsClient } from "@src/lib/push/notifications-setup";

import SplashRingsRotating from "@src/ui/SplashRingsRotating";

import * as SystemUI from "expo-system-ui";

import { initPurchases } from "@src/lib/purchases/initPurchases";

import Analytics from "@src/services/analytics";

SystemUI.setBackgroundColorAsync("#ffffff");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/* ------------------------------------------------------------------ */
/* Helpers Firestore cross-plateforme (RNFirebase natif / Web SDK web) */
/* ------------------------------------------------------------------ */

function subscribeParticipantDoc(uid, onNext, onError) {
  if (!uid) return () => {};

  if (Platform.OS === "web") {
    const { doc, onSnapshot, getFirestore } = require("firebase/firestore");
    const { app } = require("@src/lib/firebase");
    const db = getFirestore(app);
    const ref = doc(db, "participants", uid);
    return onSnapshot(ref, onNext, onError);
  }

  const firestore = require("@react-native-firebase/firestore").default;
  return firestore().collection("participants").doc(uid).onSnapshot(onNext, onError);
}

/* ---------------- Mounts qui consomment le contexte Auth ---------------- */

function AuthGateMount() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const rootState = useRootNavigationState();
  const navReady = !!rootState?.key;
  const { user, ready: authReady } = useAuth();

  useEffect(() => {
    if (!authReady || !navReady) return;

    const currentPath = pathname || "";
    const firstSegment = Array.isArray(segments) ? segments[0] : null;

    // 🧯 HOTFIX : NE JAMAIS rediriger depuis phone-login
    if (
      currentPath === "/phone-login" ||
      currentPath === "/(auth)/phone-login"
    ) {
      return;
    }

    const isRoot = currentPath === "/" || currentPath === "";

    const authPaths = new Set([
      "/auth-choice",
      "/(auth)/auth-choice",
      "/sign-in",
      "/(auth)/sign-in",
      "/phone-login",
      "/(auth)/phone-login",
      "/SignUpScreen",
      "/(auth)/SignUpScreen",
      "/phone-signup",
      "/(auth)/phone-signup",
    ]);

    const inAuthByPath = authPaths.has(currentPath);
    const inAuthByGroup = firstSegment === "(auth)" || firstSegment === "auth";
    const inAuthByPrefix = currentPath.startsWith("/(auth)/");

    const isInAuth = inAuthByPath || inAuthByGroup || inAuthByPrefix;

    const inOnboarding =
      currentPath.startsWith("/onboarding") || firstSegment === "onboarding";

    if (isRoot) {
      router.replace(user ? "/(drawer)" : "/(auth)/auth-choice");
      return;
    }

    if (!user && !isInAuth && !inOnboarding) {
      router.replace("/(auth)/auth-choice");
      return;
    }

    if (user && isInAuth && !inOnboarding) {
      router.replace("/(drawer)");
    }
  }, [authReady, navReady, user, pathname, segments, router]);

  return null;
}

function NotificationsMount() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    setupNotificationsClient?.();
  }, []);

  useEffect(() => {
    const detach = attachNotificationListeners();

    const subResponse = Notifications.addNotificationResponseReceivedListener((resp) => {
      try {
        const data = resp?.notification?.request?.content?.data || {};
        if (data.action === "OPEN_DEFI" && data.defiId) {
          router.push({
            pathname: `/(drawer)/defis/${data.defiId}`,
            params: { groupId: data.groupId },
          });
        }
      } catch (e) {
        console.log("notif response error:", e?.message || String(e));
      }
    });

    let stopRefresh = null;

    (async () => {
      try {
        if (user?.uid) {
          await registerCurrentFcmToken(user.uid);
          startFcmTokenRefreshListener(user.uid);
          stopRefresh = stopFcmTokenRefreshListener;
        }
      } catch (e) {
        console.log("Push setup failed:", e?.message || e);
      }
    })();

    return () => {
      detach?.();
      subResponse?.remove?.();
      stopRefresh?.();
    };
  }, [user?.uid, router]);

  return null;
}

/* ---------------- Root “Inner” : consomme le contexte Auth ---------------- */

function RootLayoutInner() {
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const fade = useRef(new Animated.Value(1)).current;

  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  const onboardingUnsubRef = useRef(null);

  useEffect(() => {
    initPurchases();
  }, []);

  useEffect(() => {
    return () => {
      try {
        onboardingUnsubRef.current?.();
      } catch {}
      onboardingUnsubRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      onboardingUnsubRef.current?.();
    } catch {}
    onboardingUnsubRef.current = null;

    if (!user?.uid) return;

    const currentPath = pathname || "";
    const firstSegment = Array.isArray(segments) ? segments[0] : null;

    const inAuth =
      currentPath.startsWith("/(auth)/") ||
      currentPath === "/(auth)" ||
      firstSegment === "(auth)" ||
      firstSegment === "auth";

    const inOnboarding =
      currentPath.startsWith("/onboarding") ||
      firstSegment === "onboarding";

    onboardingUnsubRef.current = subscribeParticipantDoc(
      user.uid,
      (snap) => {
        const data = snap?.data?.() || {};
        const welcomeSeen = data?.onboarding?.welcomeSeen === true;

        if (!welcomeSeen && !inOnboarding && !inAuth) {
          router.replace("/onboarding/welcome");
          return;
        }

        if (welcomeSeen && inOnboarding) {
          router.replace("/(drawer)/(tabs)/AccueilScreen");
        }
      },
      (e) => {
        console.log("[onboarding listener] error:", e?.code, e?.message || String(e));
      }
    );

    return () => {
      try {
        onboardingUnsubRef.current?.();
      } catch {}
      onboardingUnsubRef.current = null;
    };
  }, [user?.uid, pathname, segments, router]);

  // Splash animé
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 240,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(() => setShowAnimatedSplash(false));
    }, 4200);

    return () => clearTimeout(t);
  }, [fade]);

  return (
    <>
      <ImageBackground
        source={require("../assets/gradient-back.jpeg")}
        style={styles.bg}
        resizeMode="cover"
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.header },
            headerTintColor: colors.headerTint,
            headerTitleStyle: { color: colors.headerTint },
            headerShadowVisible: !isDark,
          }}
        >
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/welcome" options={{ headerShown: false }} />
        </Stack>

        <AuthGateMount />
        <NotificationsMount />

        {showAnimatedSplash && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
              opacity: fade,
            }}
          >
            <SplashRingsRotating
              size={260}
              color="#000"
              rings={2}
              logoSize={72}
              logoColor="#000"
            />
          </Animated.View>
        )}
      </ImageBackground>
    </>
  );
}

/* ---------------- Root “Outer” : fournit le Provider ---------------- */

export default function RootLayout() {
  useEffect(() => {
    Analytics.logEvent("app_open");
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AppVisibilityProvider>
                <AuthProvider>
                  <RootLayoutInner />
                </AuthProvider>
              </AppVisibilityProvider>
            </LanguageProvider>
          </ThemeProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});