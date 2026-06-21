import React from "react";
import { View, Text } from "react-native";

export default function LeaderboardRankBadge({ rank, colors, size = 28 }) {
  const n = Number(rank) || 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: size * 0.38 }}>
        {n || "—"}
      </Text>
    </View>
  );
}
