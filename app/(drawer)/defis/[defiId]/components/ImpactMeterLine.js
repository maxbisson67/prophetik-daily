// app/defis/[defiId]/components/ImpactMeterLine.js
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Line, Circle } from "react-native-svg";
import { useTheme } from "@src/theme/ThemeProvider";
import { impactPct } from "../utils/defiFormatters";

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export default function ImpactMeterLine({
  coeff,
  width = 150,
  height = 18,
  rangePct = 8, // échelle: -8% .. +8%
  showMidTick = true,
}) {
  const { colors } = useTheme();

  const pct = impactPct(coeff); // ex: -6.9 ou +7.1

  const { stroke, t01 } = useMemo(() => {
    const v = Number(pct);
    // t01 = 0..1 position sur l'échelle
    const t = clamp((v + rangePct) / (2 * rangePct), 0, 1);

    const s =
      v > 0.2 ? "#16a34a" : v < -0.2 ? "#ef4444" : colors.subtext;

    return { stroke: s, t01: t };
  }, [pct, rangePct, colors.subtext]);

  const pad = 6;
  const y = Math.round(height / 2);

  const x0 = pad;
  const x1 = width - pad;

  const cx = x0 + (x1 - x0) * t01;

  // ligne “track” neutre
  const track = colors.border;

  return (
    <View style={{ width, height, justifyContent: "center" }}>
      <Svg width={width} height={height}>
        {/* track */}
        <Line
          x1={x0}
          y1={y}
          x2={x1}
          y2={y}
          stroke={track}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* tick milieu (0%) */}
        {showMidTick ? (
          <Line
            x1={(x0 + x1) / 2}
            y1={y - 6}
            x2={(x0 + x1) / 2}
            y2={y + 6}
            stroke={colors.subtext}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.6}
          />
        ) : null}

        {/* segment coloré (du centre vers le curseur) */}
        <Line
          x1={(x0 + x1) / 2}
          y1={y}
          x2={cx}
          y2={y}
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* curseur */}
        <Circle cx={cx} cy={y} r={5} fill={stroke} />
        <Circle cx={cx} cy={y} r={8} fill="transparent" stroke={colors.background} strokeWidth={3} />
      </Svg>
    </View>
  );
}