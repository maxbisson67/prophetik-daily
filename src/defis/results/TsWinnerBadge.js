import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";

function formatPointCount(value) {
  const count = Number(value) || 0;
  return i18n.t("challenges.pointCount", {
    count,
    defaultValue: count === 1 ? "{{count}} point" : "{{count}} points",
  });
}

function getTsWinnerBadgeTheme(isDark) {
  if (isDark) {
    return {
      backgroundColor: "rgba(22, 163, 74, 0.16)",
      borderColor: "rgba(74, 222, 128, 0.32)",
      textColor: "#86efac",
      iconColor: "#4ade80",
    };
  }

  return {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    textColor: "#166534",
    iconColor: "#16a34a",
  };
}

export default function TsWinnerBadge({ summary }) {
  const { isDark } = useTheme();
  if (!summary) return null;

  const theme = getTsWinnerBadgeTheme(isDark);

  const label =
    summary.kind === "single"
      ? i18n.t("challenges.tsWinnerSingle", {
          name: summary.name,
          payoutLabel: formatPointCount(summary.payout),
          defaultValue: "Bravo {{name}}, {{payoutLabel}} de plus au compteur !",
        })
      : i18n.t("challenges.tsWinnerMultiple", {
          count: summary.sharePerWinner,
          share: summary.sharePerWinner,
          defaultValue:
            "Compétition féroce! Plusieurs gagnants se partagent {{share}} points chacun",
        });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: theme.backgroundColor,
        borderWidth: 1,
        borderColor: theme.borderColor,
      }}
    >
      <MaterialCommunityIcons
        name="trophy"
        size={18}
        color={theme.iconColor}
        style={{ marginTop: 1 }}
      />
      <Text
        style={{
          flex: 1,
          color: theme.textColor,
          fontWeight: "700",
          fontSize: 13,
          lineHeight: 18,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
