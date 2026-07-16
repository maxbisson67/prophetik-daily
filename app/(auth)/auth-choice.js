// app/(auth)/auth-choice.js
import React from "react";
import { View, Text, TouchableOpacity, SafeAreaView, Linking } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import { privacyUrlForLang, termsUrlForLang } from "@src/constants/legalUrls";
import { useLanguage } from "@src/i18n/LanguageProvider";

export default function AuthChoiceScreen() {
  const router = useRouter();
  const { lang } = useLanguage();
  const privacyUrl = privacyUrlForLang(lang);
  const termsUrl = termsUrlForLang(lang);

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

  const title = i18n.t("auth.choice.title", { defaultValue: "Welcome" });
  const headline = i18n.t("auth.choice.headline", {
    defaultValue: "Connecte-toi à Prophetik",
  });
  const body = i18n.t("auth.choice.bodySmsOnly", {
    defaultValue:
      "Connecte-toi avec ton numéro de mobile pour rejoindre des défis, voir les résultats en direct et suivre ta progression.",
  });

  const continueSms = i18n.t("auth.choice.continueSms", {
    defaultValue: "Continue with SMS",
  });

  const openUrl = async (url) => {
    try {
      await Linking.openURL(url);
    } catch {}
  };

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerBackTitle: i18n.t("auth.choice.title", { defaultValue: "Bienvenue" }),
        }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            padding: 16,
            justifyContent: "flex-start",
            paddingTop: 32,
            gap: 14,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <ProphetikIcons size="xxl" iconPosition="after" />
          </View>

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
            <Text style={{ fontSize: 22, fontWeight: "900", marginBottom: 6 }}>{headline}</Text>
            <Text style={{ color: "#6B7280" }}>{body}</Text>
          </View>

          <Button
            variant="primary"
            onPress={() => router.push("/(auth)/phone-login")}
            label={continueSms}
            testID="btn-continue-sms"
            icon={<Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />}
          />

          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              backgroundColor: "#F3F4F6",
            }}
          >
            <Text style={{ fontSize: 12, color: "#374151", lineHeight: 16 }}>
              {i18n.t("auth.choice.securityNote", {
                defaultValue:
                  "🔒 For security reasons, SMS may come from capitaine.firebaseapp.com. This is the official authentication service used by Prophetik.",
              })}
            </Text>
          </View>

          <View style={{ alignItems: "center", marginTop: 10, gap: 6 }}>
            <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center" }}>
              {i18n.t("auth.choice.footerLegal", {
                defaultValue: "En continuant, tu acceptes nos conditions d'utilisation et notre politique de confidentialité.",
              })}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <TouchableOpacity onPress={() => openUrl(termsUrl)}>
                <Text style={{ color: "#111827", fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>
                  {i18n.t("settings.legal.terms", { defaultValue: "Conditions d'utilisation" })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openUrl(privacyUrl)}>
                <Text style={{ color: "#111827", fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>
                  {i18n.t("settings.legal.privacy", { defaultValue: "Politique de confidentialité" })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
