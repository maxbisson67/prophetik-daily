// app/(auth)/auth-choice.js
import React from "react";
import { View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// i18n
import i18n from "@src/i18n/i18n";

export default function AuthChoiceScreen() {
  const router = useRouter();

  const PrimaryBtn = ({ onPress, icon, label, testID }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#111827",
        padding: 14,
        borderRadius: 12,
      }}
    >
      {icon}
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const OutlineBtn = ({ onPress, icon, label, testID }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#111827",
        backgroundColor: "#fff",
      }}
    >
      {icon}
      <Text style={{ fontWeight: "700", fontSize: 16, color: "#111827" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const Divider = ({ text }) => (
    <View style={{ alignItems: "center", marginVertical: 6 }}>
      <Text style={{ color: "#9CA3AF", fontWeight: "600" }}>{text}</Text>
    </View>
  );

  // Libellés i18n
  const title = i18n.t("auth.choice.title", { defaultValue: "Welcome" });
  const headline = i18n.t("auth.choice.headline", {
    defaultValue: "Choose your sign-in method",
  });
  const body = i18n.t("auth.choice.body", {
    defaultValue:
      "Sign in to join challenges, see live results, and track your progress.",
  });

  const continueSms = i18n.t("auth.choice.continueSms", {
    defaultValue: "Continue with SMS",
  });
  const continueEmail = i18n.t("auth.choice.continueEmail", {
    defaultValue: "Continue with Email",
  });
  const dividerOr = i18n.t("common.or", { defaultValue: "or" });

  const createSms = i18n.t("auth.choice.createSms", {
    defaultValue: "Create an account (SMS)",
  });
  const createEmail = i18n.t("auth.choice.createEmail", {
    defaultValue: "Create an account (Email)",
  });

  const footer = i18n.t("auth.choice.footer", {
    defaultValue: "By continuing, you accept our terms of use.",
  });

  return (
    <>
      <Stack.Screen options={{ title }} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: "center" }}>
          {/* Carte d'accroche */}
          <View
            style={{
              padding: 16,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#eee",
              elevation: 3,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 6 }}>
              {headline}
            </Text>
            <Text style={{ color: "#6B7280" }}>{body}</Text>
          </View>

          {/* ——— Connexion ——— */}
          <PrimaryBtn
            onPress={() => router.push("/(auth)/phone-login")}
            label={continueSms}
            testID="btn-continue-sms"
            icon={
              <Ionicons
                name="chatbox-ellipses-outline"
                size={20}
                color="#fff"
              />
            }
          />

          <OutlineBtn
            onPress={() => router.push("/(auth)/email-login")}
            label={continueEmail}
            testID="btn-continue-email"
            icon={<Ionicons name="mail-outline" size={20} color="#111827" />}
          />

          <Divider text={dividerOr} />

          {/* ——— Création de compte ——— */}
          <PrimaryBtn
            onPress={() => router.push("/(auth)/phone-signup")}
            label={createSms}
            testID="btn-signup-sms"
            icon={<Ionicons name="keypad-outline" size={20} color="#fff" />}
          />

          <OutlineBtn
            onPress={() => router.push("/(auth)/email-signup")}
            label={createEmail}
            testID="btn-signup-email"
            icon={
              <MaterialCommunityIcons
                name="account-plus-outline"
                size={20}
                color="#111827"
              />
            }
          />

          {/* Footer petit rappel */}
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center" }}>
              {footer}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}