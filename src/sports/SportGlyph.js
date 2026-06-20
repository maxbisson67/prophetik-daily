import React from "react";
import { Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function normalizeGroupSport(value) {
  const raw =
    typeof value === "string"
      ? value
      : value?.sport || value?.league || "NHL";
  return String(raw).trim().toUpperCase() === "MLB" ? "MLB" : "NHL";
}

export default function SportGlyph({ sport, colors, size = 28 }) {
  const normalized = normalizeGroupSport(sport);

  if (normalized === "MLB") {
    return <Text style={{ fontSize: size, lineHeight: size + 2 }}>⚾</Text>;
  }

  return (
    <MaterialCommunityIcons
      name="hockey-puck"
      size={size}
      color={colors?.text || "#111827"}
    />
  );
}
