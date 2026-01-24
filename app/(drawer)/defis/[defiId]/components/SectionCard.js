import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";

export default function SectionCard({ title, children, accentColor }) {
  const { colors } = useTheme();

  // Rouge Prophetik par défaut
  const accent = accentColor || colors?.danger || "#ef4444";

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      {/* Barre d’accent */}
      <View
        style={{
          height: 5,
          backgroundColor: accent,
        }}
      />

      <View style={{ padding: 12 }}>
        {!!title ? (
          <Text
            style={{
              fontWeight: "900",
              marginBottom: 10,
              color: colors.text,
            }}
          >
            {title}
          </Text>
        ) : null}

        {children}
      </View>
    </View>
  );
}