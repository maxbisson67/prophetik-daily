import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";

export default function GroupAutopilotModeBadge({ autopilotEnabled, colors, compact = false }) {
  const enabled = autopilotEnabled !== false;
  const dotColor = enabled ? "#22c55e" : colors.subtext;
  const label = enabled
    ? i18n.t("groups.autopilotMode.automatic", { defaultValue: "Défis automatiques" })
    : i18n.t("groups.autopilotMode.manual", { defaultValue: "Défis manuels" });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        marginTop: compact ? 0 : 6,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 4 : 5,
        borderRadius: 999,
        backgroundColor: colors.card2 || colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
        }}
      />
      <Text
        style={{
          color: colors.text,
          fontWeight: "800",
          fontSize: compact ? 11 : 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
