// src/ui/charts/CompareBar.js
import React, { useMemo } from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n) {
  return String(Math.round(num(n)));
}

function fmtSigned(n) {
  const x = Math.round(num(n));
  const sign = x > 0 ? "+" : "";
  return `${sign}${x}`;
}

export default function CompareBar({
  me = 0,
  other = 0,
  colors,
  labelLeft = "Moy. autres",
  labelRight = "Toi",
  height = 12,
  headerLabel, // optionnel si tu veux override
}) {
  const t = i18n.t.bind(i18n);

  const meN = num(me);
  const otherN = num(other);

  const { maxV, meW, otherW, delta, tone } = useMemo(() => {
    const maxV = Math.max(1, meN, otherN);
    const meW = meN / maxV;
    const otherW = otherN / maxV;
    const delta = meN - otherN;
    const tone = delta > 0 ? "good" : delta < 0 ? "bad" : "neutral";
    return { maxV, meW, otherW, delta, tone };
  }, [meN, otherN]);

  const deltaColor =
    tone === "good" ? "#22c55e" : tone === "bad" ? "#ef4444" : colors?.subtext || "#64748b";

  const headerText =
    headerLabel ??
    t("leaderboardMember.charts.compareBar.title", { defaultValue: "Comparison" });

  const maxScaleLabel = t("leaderboardMember.charts.compareBar.maxScale", { defaultValue: "Max scale:" });

  return (
    <View
      style={{
        marginTop: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2 ?? colors.card,
        borderRadius: 14,
        padding: 12,
      }}
    >
      {/* Header: delta */}
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
          {headerText}
        </Text>
        <Text style={{ color: deltaColor, fontWeight: "900", fontSize: 18 }}>
          {fmtSigned(delta)}
        </Text>
      </View>

      {/* Bars */}
      <View style={{ gap: 10, marginTop: 10 }}>
        {/* Others */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>{labelLeft}</Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{fmtInt(otherN)}</Text>
          </View>

          <View
            style={{
              height,
              backgroundColor: "rgba(148,163,184,0.18)",
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: `${Math.round(otherW * 100)}%`,
                height: "100%",
                backgroundColor: "rgba(148,163,184,0.65)",
                borderRadius: 999,
              }}
            />
          </View>
        </View>

        {/* Me */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>{labelRight}</Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{fmtInt(meN)}</Text>
          </View>

          <View
            style={{
              height,
              backgroundColor: "rgba(148,163,184,0.18)",
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: `${Math.round(meW * 100)}%`,
                height: "100%",
                backgroundColor: colors.primary,
                borderRadius: 999,
              }}
            />
          </View>
        </View>
      </View>

      {/* Mini hint */}
      <Text style={{ marginTop: 10, color: colors.subtext, fontSize: 11 }}>
        {maxScaleLabel} {fmtInt(maxV)}
      </Text>
    </View>
  );
}