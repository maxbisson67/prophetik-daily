import React from "react";
import { View } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import { getResultsIntroBandStyle } from "@src/defis/results/resultsTheme";

export function getDefiSectionIntroBandStyle(
  isDark,
  { bleedTop = true, bleedHorizontal = true, variant = "home" } = {}
) {
  const resultsBand = variant === "results" ? getResultsIntroBandStyle(isDark) : null;

  if (variant === "home") {
    return {
      backgroundColor: "transparent",
      paddingTop: 0,
      paddingBottom: 8,
      marginBottom: 8,
    };
  }

  return {
    backgroundColor: resultsBand?.backgroundColor ?? (isDark ? "#3a1c1c" : "#fee2e2"),
    borderBottomWidth: 1,
    borderBottomColor:
      resultsBand?.borderBottomColor ??
      (isDark ? "rgba(252, 165, 165, 0.35)" : "#fecaca"),
    ...(bleedHorizontal
      ? {
          marginHorizontal: -12,
          paddingHorizontal: 12,
        }
      : null),
    ...(bleedTop
      ? {
          marginTop: -12,
        }
      : null),
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
  };
}

export default function DefiSectionIntroBand({
  children,
  style = null,
  bleedTop = true,
  bleedHorizontal = true,
  variant = "home",
}) {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        getDefiSectionIntroBandStyle(isDark, { bleedTop, bleedHorizontal, variant }),
        style,
      ]}
    >
      {children}
    </View>
  );
}
