import React from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

export default function ProphetikUpdateBanner({
  colors,
  visible,
  message,
  currentVersion,
  latestVersion,
  storeUrl,
  forceUpdate = false,
  onDismiss,
}) {
  if (!visible) return null;

  const handlePress = async () => {
    if (!storeUrl) return;
    try {
      await Linking.openURL(storeUrl);
    } catch (e) {
      console.log("[ProphetikUpdateBanner] openURL error", e?.message || e);
    }
  };

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: 10,
          }}
        >
          <MaterialCommunityIcons name="rocket-launch-outline" size={18} color={colors.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
            {i18n.t("appUpdate.title", { defaultValue: "Mise à jour disponible" })}
          </Text>

          <Text style={{ color: colors.subtext, marginTop: 4 }}>
            {message}
          </Text>

          {!!latestVersion ? (
            <Text style={{ color: colors.subtext, marginTop: 6, fontSize: 12 }}>
              {i18n.t("appUpdate.versionLine", {
                defaultValue: "Version actuelle: {{current}} • Nouvelle version: {{latest}}",
                current: currentVersion || "—",
                latest: latestVersion || "—",
              })}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={handlePress}
              activeOpacity={0.85}
              style={{
                backgroundColor: "#b91c1c",
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {i18n.t("appUpdate.cta", { defaultValue: "Mettre à jour" })}
              </Text>
            </TouchableOpacity>

            {!forceUpdate ? (
              <TouchableOpacity
                onPress={onDismiss}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.card2,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {i18n.t("common.dismiss", { defaultValue: "Plus tard" })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}