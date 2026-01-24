import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function WinRateHeaderIcon({
  size = 18,
  color = "#000",
}) {
  return (
    <View style={{ width: size + 6, height: size + 6 }}>
      {/* Trophée */}
      <MaterialCommunityIcons
        name="trophy-outline"
        size={size}
        color={color}
      />

      {/* % en exposant */}
      <Text
        style={{
          position: "absolute",
          top: -2,
          right: -4,
          fontSize: Math.round(size * 0.55),
          fontWeight: "900",
          color,
        }}
      >
        %
      </Text>
    </View>
  );
}