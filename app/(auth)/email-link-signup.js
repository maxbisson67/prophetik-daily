// app/(auth)/email-link-signup.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { webAuth } from "@src/lib/firebase";
import { sendSignInLinkToEmail } from "firebase/auth";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import ProphetikIcons from "@src/ui/ProphetikIcons";

const PENDING_EMAIL_KEY = "auth:emailLink:pendingEmail";
const PENDING_NAME_KEY = "auth:emailLink:pendingName";

export default function EmailLinkSignupScreen() {
  const { colors } = useTheme();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const onSendLink = async () => {
    const nm = String(firstName || "").trim();
    const em = String(email || "").trim().toLowerCase();

    if (!em) {
      Alert.alert(
        i18n.t("auth.emailLink.missingEmailTitle", { defaultValue: "Missing email" }),
        i18n.t("auth.emailLink.missingEmailBody", { defaultValue: "Enter your email." })
      );
      return;
    }

    try {
      setBusy(true);

      const actionCodeSettings = {
        url: "https://capitaine.web.app/email-link/",
        handleCodeInApp: true,
        iOS: { bundleId: "com.prophetik" },
        android: { packageName: "com.prophetik", installApp: true, minimumVersion: "1" },
      };

      await sendSignInLinkToEmail(webAuth, em, actionCodeSettings);

      await AsyncStorage.setItem(PENDING_EMAIL_KEY, em);
      if (nm) await AsyncStorage.setItem(PENDING_NAME_KEY, nm);
      else await AsyncStorage.removeItem(PENDING_NAME_KEY);

      Alert.alert(
        i18n.t("auth.emailLink.sentTitle", { defaultValue: "✅ Email sent" }),
        i18n.t("auth.emailLink.sentBody", {
          defaultValue: "Check your inbox and tap the link to finish sign up.",
        })
      );
    } catch (e) {
      Alert.alert(
        i18n.t("auth.emailLink.cannotSendTitle", { defaultValue: "Cannot send link" }),
        String(e?.message || e)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
        <Stack.Screen
        options={{
            title: i18n.t("auth.emailLink.title", { defaultValue: "Continue with email link" }),
            headerBackTitle: i18n.t("auth.choice.title", { defaultValue: "Bienvenue" }),
            headerBackTitleVisible: true,
            headerBackButtonDisplayMode: "generic", // 👈 IMPORTANT iOS
            headerBackTitleStyle: { fontSize: 16 }, // optionnel, aide parfois
        }}
        />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, justifyContent: "flex-start", paddingTop: 32, gap: 14 }}>
          {/* Logo Prophetik */}
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <ProphetikIcons size="xxl" iconPosition="after" />
          </View>

          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
            {i18n.t("auth.emailLink.headline", { defaultValue: "No password needed" })}
          </Text>

          <Text style={{ color: colors.subtext }}>
            {i18n.t("auth.emailLink.body", { defaultValue: "We’ll email you a sign-in link." })}
          </Text>

          {/* Prénom (optionnel) */}
          <Text style={{ fontWeight: "700", color: colors.subtext, marginTop: 6 }}>
            {i18n.t("auth.emailLink.firstNameLabel", { defaultValue: "First name (optional)" })}
          </Text>

          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            placeholder={i18n.t("auth.emailLink.firstNamePlaceholder", { defaultValue: "e.g., Mike" })}
            placeholderTextColor={colors.subtext}
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              backgroundColor: colors.card,
              color: colors.text,
            }}
          />

          {/* Courriel */}
          <Text style={{ fontWeight: "700", color: colors.subtext, marginTop: 6 }}>
            {i18n.t("auth.emailLink.emailLabel", { defaultValue: "Email address" })}
          </Text>

          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: -6 }}>
            {i18n.t("auth.emailLink.emailHint", {
              defaultValue: "We’ll send your secure sign-in link to this email.",
            })}
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@email.com"
            placeholderTextColor={colors.subtext}
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              backgroundColor: colors.card,
              color: colors.text,
            }}
          />

          <TouchableOpacity
            disabled={busy}
            onPress={onSendLink}
            activeOpacity={0.85}
            style={{
              backgroundColor: busy ? "#9ca3af" : "#111827",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              marginTop: 6,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "800" }}>
                {i18n.t("auth.emailLink.sendCta", { defaultValue: "Send link" })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}