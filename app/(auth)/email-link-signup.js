// app/(auth)/email-link-signup.js
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { webAuth } from "@src/lib/firebase";
import { sendSignInLinkToEmail } from "firebase/auth";
import i18n from "@src/i18n/i18n";

// ✅ Unifié avec email-link.js + email-link-complete.js
const PENDING_EMAIL_KEY = "auth:emailLink:pendingEmail";
// ✅ Nouveau (prénom optionnel)
const PENDING_NAME_KEY = "auth:emailLink:pendingName";

export default function EmailLinkSignupScreen() {
  const [firstName, setFirstName] = useState(""); // ✅ nouveau
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

const redirectUrl = useMemo(() => {
  return "https://capitaine.web.app/email-link/";
}, []);

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

      // ✅ stocke email + prénom (prénom optionnel)
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
          title: i18n.t("auth.emailLink.title", { defaultValue: "Sign up with Email" }),
        }}
      />

      <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "800" }}>
          {i18n.t("auth.emailLink.headline", { defaultValue: "No password needed" })}
        </Text>

        <Text style={{ color: "#6B7280" }}>
          {i18n.t("auth.emailLink.body", { defaultValue: "We’ll email you a sign-in link." })}
        </Text>

        {/* ✅ Prénom (optionnel) */}
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          placeholder={i18n.t("auth.emailLink.firstNamePlaceholder", { defaultValue: "First name (optional)" })}
          editable={!busy}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
        />

        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@email.com"
          editable={!busy}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12 }}
        />

        <TouchableOpacity
          disabled={busy}
          onPress={onSendLink}
          style={{
            backgroundColor: busy ? "#9ca3af" : "#111",
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
    </>
  );
}