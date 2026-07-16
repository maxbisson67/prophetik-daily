import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import i18n from "@src/i18n/i18n";

export default function DeleteAccountButton({
  colors,
  deleting,
  onPress,
  disabled = false,
  compact = false,
}) {
  const isDisabled = disabled || deleting;

  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={{
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#dc2626",
          backgroundColor: colors.card,
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {deleting ? (
          <ActivityIndicator color="#dc2626" />
        ) : (
          <Text style={{ color: "#dc2626", fontWeight: "800" }}>
            {i18n.t("settings.deleteAccount.cta", { defaultValue: "Supprimer mon compte" })}
          </Text>
        )}
      </TouchableOpacity>

      {!compact ? (
        <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 18 }}>
          {i18n.t("settings.deleteAccount.hint", {
            defaultValue:
              "Suppression définitive conforme aux exigences App Store. Les abonnements actifs doivent être annulés séparément dans le Store.",
          })}
        </Text>
      ) : null}
    </View>
  );
}
