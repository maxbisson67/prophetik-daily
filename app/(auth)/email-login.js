// app/(auth)/sign-in.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";

// i18n
import i18n from "@src/i18n/i18n";

// Our “bridge” auth (firebase/auth) lives here
import { webAuth } from "@src/lib/firebase";

// Firebase Web Auth helpers (used on web AND to sign the bridge on native)
import {
  signInWithEmailAndPassword as webSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as webCreateUserWithEmailAndPassword,
  onAuthStateChanged as onWebAuthStateChanged,
} from "firebase/auth";

// RNFirebase Auth (primary auth on native)
import rnfbAuth from "@react-native-firebase/auth";

export default function SignInEmail() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Navigate home
  const goHome = () => router.replace("/(drawer)/(tabs)/AccueilScreen");

  // On native, watch RNFB auth; on web, watch webAuth
  useEffect(() => {
    let unsub;
    if (Platform.OS === "web") {
      unsub = onWebAuthStateChanged(webAuth, (u) => {
        if (u) goHome();
      });
    } else {
      unsub = rnfbAuth().onAuthStateChanged((u) => {
        if (u) goHome();
      });
    }
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [router]);

  const signIn = async () => {
    const em = String(email || "").trim().toLowerCase();
    const pw = String(password || "").trim();

    if (!em || !pw) {
      Alert.alert(
        i18n.t("auth.signIn.missingFieldsTitle", {
          defaultValue: "Missing fields",
        }),
        i18n.t("auth.signIn.missingFieldsBody", {
          defaultValue: "Enter an email and a password.",
        })
      );
      return;
    }

    try {
      setBusy(true);

      if (Platform.OS === "web") {
        // WEB: one sign-in is enough
        await webSignInWithEmailAndPassword(webAuth, em, pw);

        Alert.alert(
          i18n.t("auth.signIn.successTitle", {
            defaultValue: "✅ Signed in",
          }),
          i18n.t("auth.signIn.successBody", {
            defaultValue: "Welcome to Prophetik!",
          }),
          [{ text: i18n.t("common.ok", { defaultValue: "OK" }), onPress: goHome }]
        );
        return;
      }

      // NATIVE: sign in RNFB Auth (primary)
      await rnfbAuth().signInWithEmailAndPassword(em, pw);

      // Also sign in the Web SDK “bridge” so Firestore gets a token immediately
      try {
        await webSignInWithEmailAndPassword(webAuth, em, pw);
      } catch (e) {
        // If the bridge is already signed in or races, we ignore
        console.log("[Bridge webAuth] sign-in skipped/failed:", e?.code || e);
      }

      Alert.alert(
        i18n.t("auth.signIn.successTitle", { defaultValue: "✅ Signed in" }),
        i18n.t("auth.signIn.successBody", { defaultValue: "Welcome to Prophetik!" }),
        [
          {
            text: i18n.t("auth.signIn.letsGoCta", { defaultValue: "Let's go!" }),
            onPress: goHome,
          },
        ]
      );
    } catch (e) {
      if (e?.code === "auth/user-not-found") {
        // Create account flow
        try {
          if (Platform.OS === "web") {
            await webCreateUserWithEmailAndPassword(webAuth, em, pw);
          } else {
            // Create on RNFB first (primary)
            await rnfbAuth().createUserWithEmailAndPassword(em, pw);
            // Sign in bridge
            try {
              await webSignInWithEmailAndPassword(webAuth, em, pw);
            } catch {}
          }

          Alert.alert(
            i18n.t("auth.signIn.accountCreatedTitle", {
              defaultValue: "🎉 Account created",
            }),
            i18n.t("auth.signIn.accountCreatedBody", {
              defaultValue: "Welcome! You can now enjoy Prophetik.",
            }),
            [
              {
                text: i18n.t("auth.signIn.discoverCta", { defaultValue: "Discover" }),
                onPress: goHome,
              },
            ]
          );
        } catch (e2) {
          Alert.alert(
            i18n.t("auth.signIn.cannotCreateAccountTitle", {
              defaultValue: "Unable to create account",
            }),
            String(e2?.message || e2)
          );
        }
      } else {
        let msg = String(e?.message || e);

        if (e?.code === "auth/invalid-email") {
          msg = i18n.t("auth.signIn.errors.invalidEmail", {
            defaultValue: "Invalid email address.",
          });
        }
        if (
          e?.code === "auth/invalid-credential" ||
          e?.code === "auth/wrong-password"
        ) {
          msg = i18n.t("auth.signIn.errors.wrongCredentials", {
            defaultValue: "Email or password is incorrect.",
          });
        }
        if (e?.code === "auth/too-many-requests") {
          msg = i18n.t("auth.signIn.errors.tooManyRequests", {
            defaultValue: "Too many attempts. Try again later.",
          });
        }

        Alert.alert(
          i18n.t("auth.signIn.failTitle", { defaultValue: "Unable to sign in" }),
          msg
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t("auth.signIn.emailTitle", { defaultValue: "Email sign-in" }),
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
          <Text style={{ fontWeight: "700", fontSize: 18 }}>
            {i18n.t("auth.signIn.emailLabel", { defaultValue: "Email" })}
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder={i18n.t("auth.signIn.emailPlaceholder", {
              defaultValue: "you@email.com",
            })}
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 12,
              opacity: busy ? 0.7 : 1,
            }}
          />

          <Text style={{ fontWeight: "700", fontSize: 18, marginTop: 8 }}>
            {i18n.t("auth.signIn.passwordLabel", { defaultValue: "Password" })}
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={i18n.t("auth.signIn.passwordPlaceholder", {
              defaultValue: "••••••••",
            })}
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 12,
              opacity: busy ? 0.7 : 1,
            }}
          />

          <TouchableOpacity
            disabled={busy}
            onPress={signIn}
            style={{
              backgroundColor: busy ? "#9ca3af" : "#111",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {i18n.t("common.continue", { defaultValue: "Continue" })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}