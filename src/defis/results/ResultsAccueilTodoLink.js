import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import i18n from "@src/i18n/i18n";

export default function ResultsAccueilTodoLink({ colors, accentColor, onPress }) {
  if (typeof onPress !== "function") return null;

  const accent = accentColor || colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
      }}
    >
      <Ionicons name="calendar-outline" size={15} color={accent} />
      <Text style={{ color: accent, fontWeight: "800", fontSize: 13 }}>
        {i18n.t("challenges.goToAccueilDefi", {
          defaultValue: "Participer dans Aujourd’hui",
        })}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={accent} />
    </TouchableOpacity>
  );
}
