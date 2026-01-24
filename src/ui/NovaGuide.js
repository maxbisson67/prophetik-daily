import React from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import { Nova } from "@src/assets/nova";

export default function NovaGuide({
  variant = "neutral",   // "groups" | "format" | "calendar" | "ascension" | "thumbsUp" | "neutral"
  title,
  body,
  size = 144,
}) {
  const { colors } = useTheme();
  const img = Nova[variant] || Nova.neutral;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
      }}
    >
      <Image
        source={img}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />

      <View style={{ flex: 1, gap: 4 }}>
        {!!title && (
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {title}
          </Text>
        )}
        {!!body && (
          <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 16 }}>
            {body}
          </Text>
        )}
      </View>
    </View>
  );
}