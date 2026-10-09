import React from "react";
import { View, Text } from "react-native";

export const LEADERBOARD_TOP_SCORERS_ACCENT = "#FACC15";

function hexWithAlpha(hex, alphaHex = "22") {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return hex;
  return `#${clean}${alphaHex}`;
}

/** Même visuel que le bloc « Meilleurs pointeurs » du profil participant. */
export function LeaderboardTrophyLeading({ size = 28, accent = LEADERBOARD_TOP_SCORERS_ACCENT }) {
  const disc = Number(size) || 28;
  return (
    <View
      style={{
        width: disc,
        height: disc,
        borderRadius: disc / 2,
        borderWidth: 2,
        borderColor: accent,
        backgroundColor: hexWithAlpha(accent, "1A"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: Math.round(disc * 0.5) }}>🏆</Text>
    </View>
  );
}

/** Même icône que la section bonus soirée du profil participant. */
export function LeaderboardMoonLeading({ size = 16 }) {
  return <Text style={{ fontSize: Number(size) || 16 }}>🌙</Text>;
}
