import React from "react";
import { View, Text } from "react-native";

export default function TabBadge({ value, colors }) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return null;

  const label = n > 99 ? "99+" : String(n);

  return (
    <View
      style={{
        position: "absolute",
        top: -6,
        right: -10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary, // ou "#b91c1c"
        borderWidth: 2,
        borderColor: colors.background, // pour “décoller” du fond
      }}
    >
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}