// app/firebaseauth/link.js — iOS reCAPTCHA callback after signInWithPhoneNumber
import { useEffect, useRef } from "react";
import { useRouter, useRootNavigationState } from "expo-router";
import { ActivityIndicator, View, Text } from "react-native";
import auth from "@react-native-firebase/auth";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { peekPendingPhoneVerification } from "@src/auth/phoneAuthHelpers";

const POLL_MS = 250;
const MAX_WAIT_MS = 8000;

export default function FirebaseAuthLink() {
  const router = useRouter();
  const rootState = useRootNavigationState();
  const navReady = !!rootState?.key;
  const { user, authReady } = useAuth();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!navReady || !authReady || navigatedRef.current) return;

    let cancelled = false;
    const startedAt = Date.now();

    const goNext = () => {
      if (cancelled || navigatedRef.current) return;
      navigatedRef.current = true;

      try {
        const pending = peekPendingPhoneVerification();
        if (pending?.phone) {
          router.replace({
            pathname: "/(auth)/phone-login",
            params: {
              phone: pending.phone,
              step: pending.confirmation ? "2" : "1",
              ...(pending.displayName ? { displayName: pending.displayName } : {}),
            },
          });
          return;
        }

        if (user?.uid) {
          router.replace("/(drawer)/(tabs)/AccueilScreen");
          return;
        }

        router.replace("/(auth)/phone-login");
      } catch (e) {
        console.warn("[firebaseauth/link] navigation failed", e?.message || e);
        navigatedRef.current = false;
      }
    };

    const poll = () => {
      if (cancelled || navigatedRef.current) return;

      const pending = peekPendingPhoneVerification();
      const elapsed = Date.now() - startedAt;
      const ready =
        !!pending?.confirmation ||
        !!user?.uid ||
        elapsed >= MAX_WAIT_MS;

      if (ready) {
        goNext();
        return;
      }

      setTimeout(poll, POLL_MS);
    };

    const timer = setTimeout(poll, 300);

    const unsub = auth().onAuthStateChanged(() => {
      if (!navigatedRef.current) poll();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      try {
        unsub?.();
      } catch {}
    };
  }, [navReady, authReady, router, user?.uid]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 10 }}>Vérification en cours…</Text>
    </View>
  );
}
