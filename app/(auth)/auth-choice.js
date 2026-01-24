// app/(auth)/auth-choice.js
import React from "react";
import { View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import ProphetikIcons from "@src/ui/ProphetikIcons";

export default function AuthChoiceScreen() {
  const router = useRouter();

  const Button = ({ variant = "primary", onPress, icon, label, testID }) => {
    const isPrimary = variant === "primary";

    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 12,
          backgroundColor: isPrimary ? "#111827" : "#fff",
          borderWidth: isPrimary ? 0 : 1,
          borderColor: "#111827",
        }}
      >
        {icon}
        <Text
          style={{
            fontWeight: "800",
            fontSize: 16,
            color: isPrimary ? "#fff" : "#111827",
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // i18n
  const title = i18n.t("auth.choice.title", { defaultValue: "Welcome" });
  const headline = i18n.t("auth.choice.headline", {
    defaultValue: "Choose your sign-in method",
  });
  const body = i18n.t("auth.choice.body", {
    defaultValue:
      "Sign in to join challenges, see live results, and track your progress.",
  });

  const continueEmailLink = i18n.t("auth.choice.continueEmailLink", {
    defaultValue: "Continue with email link",
  });
  const continueSms = i18n.t("auth.choice.continueSms", {
    defaultValue: "Continue with SMS",
  });
  const continueEmail = i18n.t("auth.choice.continueEmail", {
    defaultValue: "Continue with email",
  });

  const footer = i18n.t("auth.choice.footer", {
    defaultValue: "By continuing, you accept our terms of use.",
  });

  return (
    <>
      <Stack.Screen options={{ title }} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 14 }}>
          {/* Logo Prophetik */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <ProphetikIcons size="xxl" iconPosition="after" />
          </View>
          {/* Carte d’intro */}
          <View
            style={{
              padding: 16,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#eee",
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "900", marginBottom: 6 }}>
              {headline}
            </Text>
            <Text style={{ color: "#6B7280" }}>{body}</Text>
          </View>

          {/* 1) Email link (principal) */}
          <Button
            variant="primary"
            onPress={() => router.push("/(auth)/email-link-signup")}
            label={continueEmailLink}
            testID="btn-continue-email-link"
            icon={<Ionicons name="mail-outline" size={20} color="#fff" />}
          />

          {/* 2) SMS */}
          <Button
            variant="outline"
            onPress={() => router.push("/(auth)/phone-login")}
            label={continueSms}
            testID="btn-continue-sms"
            icon={<Ionicons name="chatbubble-ellipses-outline" size={20} color="#111827" />}
          />

          {/* 3) Email password (temp) */}
          <Button
            variant="outline"
            onPress={() => router.push("/(auth)/email-login")}
            label={continueEmail}
            testID="btn-continue-email"
            icon={<Ionicons name="mail-outline" size={20} color="#111827" />}
          />

          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              backgroundColor: "#F3F4F6",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: "#374151",
                lineHeight: 16,
              }}
            >
              {i18n.t("auth.choice.securityNote", {
                defaultValue:
                  "🔒 For security reasons, emails and SMS may come from capitaine.firebaseapp.com. This is the official authentication service used by Prophetik.",
              })}
            </Text>
          </View>

          <View style={{ alignItems: "center", marginTop: 10 }}>
            <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center" }}>
              {footer}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}