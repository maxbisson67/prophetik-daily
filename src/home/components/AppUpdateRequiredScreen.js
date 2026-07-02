import React from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import i18n from "@src/i18n/i18n";
import { useLanguage } from "@src/i18n/LanguageProvider";

export default function AppUpdateRequiredScreen({
  colors,
  message,
  currentVersion,
  minSupportedVersion,
  storeUrl,
}) {
  useLanguage();

  const handlePress = async () => {
    if (!storeUrl) return;
    try {
      await Linking.openURL(storeUrl);
    } catch (e) {
      console.log("[AppUpdateRequiredScreen] openURL error", e?.message || e);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 20,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <MaterialCommunityIcons name="update" size={28} color="#b91c1c" />
        </View>

        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20, textAlign: "center" }}>
          {i18n.t("appUpdate.requiredTitle", {
            defaultValue: "Mise à jour requise",
          })}
        </Text>

        <Text style={{ color: colors.subtext, marginTop: 10, textAlign: "center", lineHeight: 22 }}>
          {message}
        </Text>

        {!!minSupportedVersion ? (
          <Text style={{ color: colors.subtext, marginTop: 12, fontSize: 13, textAlign: "center" }}>
            {i18n.t("appUpdate.versionLine", {
              defaultValue: "Version installée : {{current}} • Minimum requis : {{minimum}}",
              current: currentVersion || "—",
              minimum: minSupportedVersion || "—",
            })}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handlePress}
          disabled={!storeUrl}
          activeOpacity={0.85}
          style={{
            marginTop: 20,
            backgroundColor: storeUrl ? "#b91c1c" : "#9ca3af",
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 12,
            width: "100%",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
            {i18n.t("appUpdate.cta", { defaultValue: "Mettre à jour" })}
          </Text>
        </TouchableOpacity>

        {!storeUrl ? (
          <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 12, textAlign: "center" }}>
            {i18n.t("appUpdate.missingStoreUrl", {
              defaultValue: "Lien du store indisponible pour le moment.",
            })}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
