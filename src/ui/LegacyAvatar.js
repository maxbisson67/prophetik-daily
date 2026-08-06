import React from "react";
import { Image, View } from "react-native";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");

export default function LegacyAvatar({
  uri,
  name,
  size = 40,
  colors = {},
  borderWidth = 1,
}) {
  const borderColor = colors.border || "#e5e7eb";
  const backgroundColor = colors.card2 || colors.border || "#f3f4f6";

  return (
    <Image
      source={uri ? { uri } : AVATAR_PLACEHOLDER}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        borderWidth,
        borderColor,
      }}
      resizeMode="cover"
      accessibilityLabel={name || "avatar"}
    />
  );
}

export function LegacyAvatarFrame({ size, colors, children, borderWidth = 1 }) {
  const borderColor = colors.border || "#e5e7eb";
  const backgroundColor = colors.card2 || colors.border || "#f3f4f6";

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor,
        borderWidth,
        borderColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}
