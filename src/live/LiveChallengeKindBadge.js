import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
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

function badgeTextStyle({ accent, compact, tableHeader, letterSpacing = 0.5, inverted = false }) {
  return {
    color: inverted ? "#fff" : accent,
    fontSize: tableHeader ? 9 : compact ? 13 : 15,
    lineHeight: tableHeader ? 10 : compact ? 14 : 16,
    letterSpacing: tableHeader ? 0.4 : letterSpacing,
    fontWeight: "800",
    includeFontPadding: false,
    textAlign: "center",
  };
}

function BadgeFrame({
  accent,
  colors,
  children,
  compact = false,
  tableHeader = false,
  inverted = false,
}) {
  const borderColor = inverted
    ? "rgba(255,255,255,0.85)"
    : accent || colors.primary || "#ef4444";
  const minHeight = tableHeader ? 22 : compact ? 30 : 34;
  const radius = tableHeader ? 7 : 10;
  const innerRadius = Math.max(radius - 2, 4);
  const borderWidth = tableHeader ? 1.5 : 2;

  return (
    <View
      style={{
        minWidth: tableHeader ? 34 : compact ? 52 : 48,
        minHeight,
        borderRadius: radius,
        borderWidth,
        borderColor,
        backgroundColor: inverted ? "rgba(255,255,255,0.14)" : hexWithAlpha(borderColor, "1A"),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: tableHeader ? 3 : compact ? 6 : 8,
        paddingVertical: tableHeader ? 2 : 4,
        flexShrink: 0,
        overflow: "hidden",
        shadowColor: inverted || tableHeader ? "transparent" : borderColor,
        shadowOffset: { width: 0, height: inverted || tableHeader ? 0 : 2 },
        shadowOpacity: inverted || tableHeader ? 0 : 0.25,
        shadowRadius: inverted || tableHeader ? 0 : 4,
        elevation: inverted || tableHeader ? 0 : 3,
      }}
    >
      {!inverted ? (
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
      ) : null}
      {children}
    </View>
  );
}

function FgcBadge({ colors, sport, compact, tableHeader, inverted = false }) {
  const accent = LIVE_BADGE_ACCENTS.fgc;
  const league = String(sport || "MLB").toUpperCase();
  const label =
    league === "MLB"
      ? i18n.t("live.badge.rbi", { defaultValue: "SOLO" })
      : i18n.t("live.badge.goal", { defaultValue: "SOLO" });

  return (
    <BadgeFrame
      accent={accent}
      colors={colors}
      compact={compact}
      tableHeader={tableHeader}
      inverted={inverted}
    >
      <Text
        style={badgeTextStyle({ accent, compact, tableHeader, letterSpacing: 0.8, inverted })}
        numberOfLines={1}
        adjustsFontSizeToFit={!tableHeader}
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </BadgeFrame>
  );
}

function TpBadge({ colors, compact, tableHeader, inverted = false }) {
  const accent = LIVE_BADGE_ACCENTS.tp;
  const label = i18n.t("live.badge.score", { defaultValue: "DUO" });

  return (
    <BadgeFrame
      accent={accent}
      colors={colors}
      compact={compact}
      tableHeader={tableHeader}
      inverted={inverted}
    >
      <Text
        style={badgeTextStyle({ accent, compact, tableHeader, inverted })}
        numberOfLines={1}
        adjustsFontSizeToFit={!tableHeader}
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </BadgeFrame>
  );
}

function TsBadge({ colors, compact, tableHeader, inverted = false }) {
  const accent = LIVE_BADGE_ACCENTS.ts;
  const label = i18n.t("live.badge.trio", { defaultValue: "TRIO" });

  return (
    <BadgeFrame
      accent={accent}
      colors={colors}
      compact={compact}
      tableHeader={tableHeader}
      inverted={inverted}
    >
      <Text style={badgeTextStyle({ accent, compact, tableHeader, letterSpacing: 0.3, inverted })}>
        {label}
      </Text>
    </BadgeFrame>
  );
}

export default function LiveChallengeKindBadge({
  kind,
  colors,
  sport = "MLB",
  compact = false,
  tableHeader = false,
  inverted = false,
  onPress = null,
}) {
  const key = String(kind || "").toLowerCase();

  const badge =
    key === "fgc" ? (
      <FgcBadge
        colors={colors}
        sport={sport}
        compact={compact}
        tableHeader={tableHeader}
        inverted={inverted}
      />
    ) : key === "tp" ? (
      <TpBadge colors={colors} compact={compact} tableHeader={tableHeader} inverted={inverted} />
    ) : key === "ts" ? (
      <TsBadge colors={colors} compact={compact} tableHeader={tableHeader} inverted={inverted} />
    ) : null;

  if (!badge) return null;

  if (!onPress) return badge;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
      {badge}
    </TouchableOpacity>
  );
}
