    // src/ui/charts/LineChart.js
    import React, { useMemo } from "react";
    import { View } from "react-native";
    import Svg, { Path, Circle } from "react-native-svg";

    function makePath(points) {
    if (!points.length) return "";
    const [p0, ...rest] = points;
    return ["M", p0.x, p0.y, ...rest.flatMap((p) => ["L", p.x, p.y])].join(" ");
    }

    export default function LineChart({
    data = [],            // [{ xLabel, value }]
    width = 320,
    height = 140,
    stroke = "#4f46e5",
    dot = true,
    padding = 12,
    }) {
    const { pts } = useMemo(() => {
        const vals = data.map((d) => Number(d.value) || 0);
        const max = Math.max(1, ...vals);
        const min = Math.min(0, ...vals);

        const innerW = Math.max(1, width - padding * 2);
        const innerH = Math.max(1, height - padding * 2);

        const n = Math.max(1, data.length - 1);

        const pts = data.map((d, i) => {
        const v = Number(d.value) || 0;
        const t = (v - min) / (max - min || 1);
        return {
            x: padding + (innerW * i) / n,
            y: padding + innerH * (1 - t),
            v,
        };
        });

        return { pts };
    }, [data, width, height, padding]);

    const path = useMemo(() => makePath(pts), [pts]);

    return (
        <View style={{ width, height }}>
        <Svg width={width} height={height}>
            <Path d={path} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" />
            {dot
            ? pts.map((p, idx) => (
                <Circle key={idx} cx={p.x} cy={p.y} r={4} fill={stroke} />
                ))
            : null}
        </Svg>
        </View>
    );
    }