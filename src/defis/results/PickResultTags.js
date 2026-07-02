import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";

export function formatPickBravoBadgeLabel(points, t = i18n.t.bind(i18n)) {
  const pts = Number(points) || 0;
  if (pts <= 0) return null;

  return t("challenges.bravoPoints", {
    defaultValue: "Bravo {{points}} points",
    points: pts,
  });
}

export function getPickBravoHighlightTheme(isDark, { provisional = false } = {}) {
  return {
    bandeau: {
      backgroundColor: isDark
        ? provisional
          ? "rgba(185, 28, 28, 0.12)"
          : "rgba(185, 28, 28, 0.16)"
        : provisional
        ? "rgba(185, 28, 28, 0.06)"
        : "rgba(185, 28, 28, 0.09)",
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: isDark
        ? provisional
          ? "rgba(252, 165, 165, 0.18)"
          : "rgba(252, 165, 165, 0.24)"
        : provisional
        ? "rgba(185, 28, 28, 0.12)"
        : "rgba(185, 28, 28, 0.16)",
    },
  };
}

export function PickBravoBadge({ label, provisional = false, isDark = false }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: isDark
          ? provisional
            ? "rgba(22,163,74,0.16)"
            : "rgba(22,163,74,0.22)"
          : provisional
          ? "rgba(22,163,74,0.08)"
          : "rgba(22,163,74,0.14)",
        borderWidth: 1,
        borderColor: isDark
          ? provisional
            ? "rgba(74, 222, 128, 0.32)"
            : "rgba(74, 222, 128, 0.42)"
          : provisional
          ? "rgba(22,163,74,0.28)"
          : "rgba(22,163,74,0.38)",
      }}
    >
      <Text
        style={{
          color: isDark ? "#4ade80" : "#16a34a",
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function PickOopsBadge({ isDark = false, provisional = false }) {
  const label = provisional
    ? i18n.t("challenges.tpPointsInSight", {
        defaultValue: "{{points}} points en vue",
        points: 0,
      })
    : i18n.t("challenges.oopsPoints", { defaultValue: "Oups, 0 points" });

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: isDark ? "rgba(107, 114, 128, 0.22)" : "rgba(107, 114, 128, 0.1)",
        borderWidth: 1,
        borderColor: isDark ? "rgba(156, 163, 175, 0.38)" : "rgba(107, 114, 128, 0.28)",
      }}
    >
      <Text
        style={{
          color: isDark ? "#d1d5db" : "#6b7280",
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
