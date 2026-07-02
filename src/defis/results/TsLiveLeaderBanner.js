import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";

function formatLiveScore(value) {
  const score = Number(value) || 0;
  return i18n.t("challenges.tsLiveLeaderScore", {
    score: score.toFixed(0),
    defaultValue: "{{score}} points",
  });
}

function getTsLiveLeaderTheme(isDark) {
  if (isDark) {
    return {
      backgroundColor: "rgba(234, 88, 12, 0.14)",
      borderColor: "rgba(251, 146, 60, 0.32)",
      textColor: "#fdba74",
      iconColor: "#fb923c",
    };
  }

  return {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    textColor: "#9A3412",
    iconColor: "#EA580C",
  };
}

export default function TsLiveLeaderBanner({ summary }) {
  const { isDark } = useTheme();
  if (!summary) return null;

  const theme = getTsLiveLeaderTheme(isDark);

  const label =
    summary.kind === "tie"
      ? i18n.t("challenges.tsLiveLeaderTie", {
          defaultValue: "La course est féroce avec des égalités en tête.",
        })
      : summary.isYou
      ? i18n.t("challenges.tsLiveLeaderYou", {
          scoreLabel: formatLiveScore(summary.score),
          defaultValue: "Tu es actuellement en tête avec {{scoreLabel}}.",
        })
      : i18n.t("challenges.tsLiveLeaderSingle", {
          name: summary.name,
          scoreLabel: formatLiveScore(summary.score),
          defaultValue: "{{name}} est actuellement en tête avec {{scoreLabel}}.",
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
        name="broadcast"
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
