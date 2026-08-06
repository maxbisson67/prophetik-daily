import React from "react";
import { Image, View } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";

const PLACEHOLDER_JERSEY_DARK = require("@src/assets/jerseys/placeholder-mlb.png");
const PLACEHOLDER_JERSEY_LIGHT = require("@src/assets/jerseys/placeholder-mlb-light.png");

export default function JerseyPlaceholder({
  size = 40,
  colors = {},
  name = "",
  borderRadius = null,
  square = true,
  emphasized = false,
}) {
  const { isDark } = useTheme();
  const borderColor = emphasized
    ? colors.primary || "#b91c1c"
    : colors.border || "#e5e7eb";
  const backgroundColor = isDark ? "#0b0b0b" : "#ffffff";
  const jerseySource = isDark ? PLACEHOLDER_JERSEY_DARK : PLACEHOLDER_JERSEY_LIGHT;
  const radius = borderRadius ?? (square ? Math.max(6, Math.round(size * 0.22)) : size / 2);
  const imageSize = Math.round(size * 0.96);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor,
        borderWidth: emphasized ? 2 : 1,
        borderColor,
        borderStyle: "solid",
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel={name ? `${name} — maillot non configuré` : "Maillot non configuré"}
    >
      <Image
        source={jerseySource}
        style={{ width: imageSize, height: imageSize }}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}
