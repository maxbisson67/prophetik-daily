// src/home/components/MainMetricsRow.js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import BlurValue from "@src/ui/BlurValue";
import i18n from "@src/i18n/i18n";

function MetricCard({ colors, title, value, subtitle, locked, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 12,
        minHeight: 74,
        justifyContent: "space-between",
      }}
    >
      <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>
        {title}
      </Text>

      <BlurValue
        colors={colors}
        value={String(value ?? "")}
        blurred={!!locked}
      />

      {!!subtitle && (
        <Text
          style={{
            color: colors.subtext,
            fontSize: 11,
            marginTop: 2,
            opacity: locked ? 0.6 : 1,
          }}
        >
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * Props attendues:
 * - points (number)
 * - plays (number) : nb participations
 * - wins (number) : nb victoires
 * - ppg (number)  : points per game (optionnel, sinon calculé)
 * - tierLower ("free"|"vip"|...)
 * - onUpgrade () => void
 */
export default function MainMetricsRow({
  colors,
  points = 0,
  plays = 0,
  wins = 0,
  ppg: ppgProp = null,
  tierLower = "free",
  onUpgrade,
}) {
  const isFree = String(tierLower).toLowerCase() === "free";

  const defirate = useMemo(() => {
    const p = Number(plays || 0);
    const w = Number(wins || 0);
    if (p <= 0) return 0;
    return w / p;
  }, [plays, wins]);

  const ppg = useMemo(() => {
    if (ppgProp !== null && ppgProp !== undefined) return Number(ppgProp || 0);

  }, [ppgProp]);

  const pct = (x) => `${Math.round(x * 100)}%`;

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <MetricCard
        colors={colors}
        title={i18n.t("home.metrics.points")}
        value={Number(points || 0).toLocaleString()}
        subtitle={
            plays
            ? i18n.t("home.metrics.pointsSubtitle", { count: plays })
            : i18n.t("home.metrics.pointsSubtitleEmpty")
        }
        locked={false}
        onPress={() => {}}
      />

    <MetricCard
        colors={colors}
        title={i18n.t("home.metrics.defirate")}
        value={isFree ? "xx %" : pct(defirate)}
        subtitle={
            isFree
            ? i18n.t("home.metrics.unlockCta")
            : i18n.t("home.metrics.defirateSubtitle", { wins })
        }
        locked={isFree}
        onPress={() => (isFree ? onUpgrade?.() : null)} 
    />

  
    <MetricCard
        colors={colors}
        title={i18n.t("home.metrics.ppg")}
        value={isFree ? "1.xx" : ppg.toFixed(2)}
        subtitle={
            isFree
            ? i18n.t("home.metrics.unlockCta")
            : i18n.t("home.metrics.ppgSubtitle")
        }
        locked={isFree}
        onPress={() => (isFree ? onUpgrade?.() : null)}
    />

      
    </View>
  );
}