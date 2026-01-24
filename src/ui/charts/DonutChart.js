import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

export function DonutChart({
  value = 0.0,
  size = 110,
  stroke = "#4f46e5",
  track = "#e5e7eb",
  strokeWidth = 12,
  label,
  labelColor = "#111827",
  subLabel,
  subColor = "#6b7280",
  showPercent = true,
  centerText,
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const dash = c * clamped;
  const pct = Math.round(clamped * 100);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      <View style={{ position: "absolute", alignItems: "center" }}>
        {showPercent ? (
          <Text style={{ fontWeight: "900", fontSize: 18, color: labelColor }}>{pct}%</Text>
        ) : (
          <Text style={{ fontWeight: "900", fontSize: 15, color: labelColor }}>
            {centerText ?? ""}
          </Text>
        )}

        {!!label && <Text style={{ fontSize: 12, fontWeight: "800", color: subColor }}>{label}</Text>}
        {!!subLabel && <Text style={{ fontSize: 11, color: subColor }}>{subLabel}</Text>}
      </View>
    </View>
  
  );
}

export default DonutChart;