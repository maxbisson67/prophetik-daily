// app/_layout.js
import React, { useEffect, useState, useRef } from "react";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { View, ImageBackground, StyleSheet, Animated, Easing } from "react-native";
import { Stack, useRouter, useRootNavigationState, usePathname, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { doc, onSnapshot } from "firebase/firestore";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { db } from "@src/lib/firebase";
import { AuthProvider, useAuth } from "@src/auth/SafeAuthProvider";
import { AppVisibilityProvider} from "@src/providers/AppVisibilityProvider";
import "@src/lib/safeAsyncStorage";
import { ThemeProvider } from "@src/theme/ThemeProvider";

import {
  attachNotificationListeners,
  registerCurrentFcmToken,
  startFcmTokenRefreshListener,
  stopFcmTokenRefreshListener,
} from "@src/lib/push/registerFcmToken";
import { setupNotificationsClient } from "@src/lib/push/notifications-setup";

import SplashRingsRotating from "@src/ui/SplashRingsRotating";

import * as SystemUI from 'expo-system-ui';
SystemUI.setBackgroundColorAsync('#ffffff');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

    const isRoot = !pathname || pathname === "/";
    const authPaths = new Set(["/auth-choice", "/sign-in", "/phone-login"]);
    const inAuthByPath = authPaths.has(pathname);
    const inAuthByGroup = Array.isArray(segments) && segments[0] === "(auth)";
    const isInAuth = inAuthByPath || inAuthByGroup;

    if (isRoot) {
      router.replace(user ? "/(drawer)" : "/(auth)/auth-choice");
      return;
    }
    if (!user && !isInAuth) {
      router.replace("/(auth)/auth-choice");
      return;
    }
    if (user && isInAuth) {
      router.replace("/(drawer)");
      return;
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
  const router = useRouter();
  const pathname = usePathname();
  const hasRoutedOnboarding = useRef(false);

  // Garde-fou onboarding (ne déclenche que depuis des entrées "accueil")
  useEffect(() => {
    if (!user?.uid) return;
    if (hasRoutedOnboarding.current) return;

    const ref = doc(db, "participants", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const seen = !!snap.data()?.onboarding?.welcomeSeen;

      const p = pathname || "";
      const isEntry =
        p === "/" ||
        p === "/(drawer)" ||
        p === "/(drawer)/(tabs)" ||
        p === "/(drawer)/(tabs)/AccueilScreen";
      const inOnboarding = p.startsWith("/onboarding");

      if (!seen && isEntry && !inOnboarding) {
        hasRoutedOnboarding.current = true;
        router.replace("/onboarding/welcome");
      }
    });
    
    return () => {
      try { unsub?.(); } catch {}
    };
    //return () => unsub();
  }, [user?.uid, pathname, router]);

  // Splash animé (fade-out)
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
            contentStyle: { backgroundColor: "#ffffff" },
            headerStyle: { backgroundColor: "#fff" },
            headerShadowVisible: true,
          }}
        >
          {/* Section principale : drawer */}
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />

          {/* Auth (login, signup) */}
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />

          {/* Onboarding global */}
          <Stack.Screen
            name="onboarding/welcome"
            options={{ headerShown: false }}
          />
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
            
          <SplashRingsRotating size={260} color="#000" rings={2} logoSize={72} logoColor="#000" />

          </Animated.View>
        )}
      </ImageBackground>
    </>
  );
}

/* ---------------- Root “Outer” : fournit le Provider ---------------- */

export default function RootLayout() {
  return (
     <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppVisibilityProvider>
            <AuthProvider>
             <RootLayoutInner />
            </AuthProvider>
          </AppVisibilityProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});