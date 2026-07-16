import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";

const LIVE_BADGE_ACCENTS = {
  fgc: "#ef4444",
  tp: "#2563eb",
  ts: "#16a34a",
};

export { LIVE_BADGE_ACCENTS };

function hexWithAlpha(hex, alphaHex = "22") {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return hex;
  return `#${clean}${alphaHex}`;
}

function badgeTextStyle({ accent, compact, letterSpacing = 0.5 }) {
  return {
    color: accent,
    fontSize: compact ? 13 : 15,
    lineHeight: compact ? 14 : 16,
    letterSpacing,
    fontWeight: "800",
    includeFontPadding: false,
    textAlign: "center",
  };
}

function BadgeFrame({ accent, colors, children, compact = false }) {
  const borderColor = accent || colors.primary || "#ef4444";
  const minHeight = compact ? 30 : 34;
  const radius = 10;
  const innerRadius = Math.max(radius - 2, 6);

  return (
    <View
      style={{
        minWidth: compact ? 52 : 48,
        minHeight,
        borderRadius: radius,
        borderWidth: 2,
        borderColor,
        backgroundColor: hexWithAlpha(borderColor, "1A"),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: compact ? 6 : 8,
        paddingVertical: 4,
        flexShrink: 0,
        overflow: "hidden",
        shadowColor: borderColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 1,
          left: 1,
          right: 1,
          bottom: 1,
          borderRadius: innerRadius,
          borderWidth: 1,
          borderColor: hexWithAlpha(borderColor, "28"),
          borderTopColor: hexWithAlpha(borderColor, "50"),
          borderBottomColor: hexWithAlpha(borderColor, "14"),
        }}
      />
      {children}
    </View>
  );
}

function FgcBadge({ colors, sport, compact }) {
  const accent = LIVE_BADGE_ACCENTS.fgc;
  const league = String(sport || "MLB").toUpperCase();
  const label =
    league === "MLB"
      ? i18n.t("live.badge.rbi", { defaultValue: "SOLO" })
      : i18n.t("live.badge.goal", { defaultValue: "SOLO" });

  return (
    <BadgeFrame accent={accent} colors={colors} compact={compact}>
      <Text
        style={badgeTextStyle({ accent, compact, letterSpacing: 0.8 })}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </BadgeFrame>
  );
}

function TpBadge({ colors, compact }) {
  const accent = LIVE_BADGE_ACCENTS.tp;
  const label = i18n.t("live.badge.score", { defaultValue: "DUO" });

  return (
    <BadgeFrame accent={accent} colors={colors} compact={compact}>
      <Text
        style={badgeTextStyle({ accent, compact })}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </BadgeFrame>
  );
}

function TsBadge({ colors, compact }) {
  const accent = LIVE_BADGE_ACCENTS.ts;
  const label = i18n.t("live.badge.trio", { defaultValue: "TRIO" });

  return (
    <BadgeFrame accent={accent} colors={colors} compact={compact}>
      <Text style={badgeTextStyle({ accent, compact, letterSpacing: 0.3 })}>{label}</Text>
    </BadgeFrame>
  );
}

export default function LiveChallengeKindBadge({ kind, colors, sport = "MLB", compact = false }) {
  const key = String(kind || "").toLowerCase();

  if (key === "fgc") {
    return <FgcBadge colors={colors} sport={sport} compact={compact} />;
  }

  if (key === "tp") {
    return <TpBadge colors={colors} compact={compact} />;
  }

  if (key === "ts") {
    return <TsBadge colors={colors} compact={compact} />;
  }

  return null;
}
