import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";

const COUNT_COLORS = {
  balls: "#22c55e",
  strikes: "#ef4444",
  outs: "#94a3b8",
};

function resolveSituationPalette({ light, isDark, colors }) {
  if (light) {
    return {
      frameBg: "rgba(255,255,255,0.2)",
      frameBorder: "rgba(255,255,255,0.55)",
      infieldBg: "rgba(255,255,255,0.14)",
      activeColor: "#fecaca",
      occupiedBaseColor: "#ef4444",
      emptyColor: "rgba(255,255,255,0.7)",
      emptyBaseFill: "transparent",
      labelColor: "rgba(255,255,255,0.92)",
      valueColor: "#ffffff",
      outerBg: null,
      outerBorder: null,
      countColors: {
        balls: "#86efac",
        strikes: "#fca5a5",
        outs: "rgba(255,255,255,0.85)",
      },
    };
  }

  if (isDark === false) {
    return {
      frameBg: "#ecfdf5",
      frameBorder: "#16a34a",
      infieldBg: "rgba(22,163,74,0.2)",
      activeColor: "#dc2626",
      occupiedBaseColor: "#dc2626",
      emptyColor: "#64748b",
      emptyBaseFill: "transparent",
      labelColor: "#334155",
      valueColor: "#0f172a",
      outerBg: "#f8fafc",
      outerBorder: "#cbd5e1",
      countColors: COUNT_COLORS,
    };
  }

  return {
    frameBg: colors?.card2 || "#1a2230",
    frameBorder: colors?.border || "#334155",
    infieldBg: "rgba(34,197,94,0.22)",
    activeColor: "#f87171",
    occupiedBaseColor: "#dc2626",
    emptyColor: "#64748b",
    emptyBaseFill: "transparent",
    labelColor: "#cbd5e1",
    valueColor: "#f8fafc",
    outerBg: colors?.card2 || "#1a2230",
    outerBorder: colors?.border || "#334155",
    countColors: {
      balls: "#4ade80",
      strikes: "#f87171",
      outs: "#cbd5e1",
    },
  };
}

export function mlbLiveSituation(game) {
  if (!game?.isLive) return null;
  const balls = game.balls;
  const strikes = game.strikes;
  const outs = game.outs;
  if (balls == null && strikes == null && outs == null) return null;

  return {
    balls: Number.isFinite(Number(balls)) ? Number(balls) : 0,
    strikes: Number.isFinite(Number(strikes)) ? Number(strikes) : 0,
    outs: Number.isFinite(Number(outs)) ? Number(outs) : 0,
    onFirst: !!game.onFirst,
    onSecond: !!game.onSecond,
    onThird: !!game.onThird,
    runnersOnBase:
      Number.isFinite(Number(game.runnersOnBase))
        ? Number(game.runnersOnBase)
        : [game.onFirst, game.onSecond, game.onThird].filter(Boolean).length,
  };
}

function CountDots({ filled, total, activeColor, emptyColor, dotSize = 7, emptyFill }) {
  const gap = dotSize >= 7 ? 4 : 3;
  return (
    <View style={{ flexDirection: "row", gap, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < filled;
        return (
          <View
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: isFilled ? activeColor : emptyFill || "transparent",
              borderWidth: isFilled ? 0 : 1.5,
              borderColor: isFilled ? activeColor : emptyColor,
            }}
          />
        );
      })}
    </View>
  );
}

const BASE_BAG_SIZE = {
  compact: 11,
  regular: 12,
};

function BaseBag({ filled, size, occupiedColor, emptyColor }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: filled ? occupiedColor : "transparent",
        borderWidth: 2,
        borderColor: filled ? occupiedColor : emptyColor,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

export function MlbBaseDiamond({
  onFirst = false,
  onSecond = false,
  onThird = false,
  size = 44,
  occupiedBaseColor = "#dc2626",
  emptyColor = "rgba(148,163,184,0.85)",
  light = false,
  compact = false,
  frameBg,
  frameBorder,
  infieldBg,
}) {
  const bag = compact ? BASE_BAG_SIZE.compact : BASE_BAG_SIZE.regular;
  const pad = compact ? 6 : 8;
  const frameSize = size + pad * 2;

  const resolvedFrameBg = frameBg ?? (light ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.06)");
  const resolvedFrameBorder = frameBorder ?? (light ? "rgba(255,255,255,0.32)" : "rgba(148,163,184,0.45)");
  const resolvedInfieldBg = infieldBg ?? (light ? "rgba(255,255,255,0.1)" : "rgba(34,197,94,0.12)");

  const baseSlotStyle = {
    position: "absolute",
    width: bag,
    height: bag,
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <View
      style={{
        width: frameSize,
        height: frameSize,
        borderRadius: compact ? 11 : 12,
        backgroundColor: resolvedFrameBg,
        borderWidth: compact ? 2 : 1.5,
        borderColor: resolvedFrameBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: size, height: size, position: "relative" }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: size * 0.14,
            left: size * 0.14,
            width: size * 0.72,
            height: size * 0.72,
            backgroundColor: resolvedInfieldBg,
            borderRadius: 3,
            borderWidth: light ? 0 : 1,
            borderColor: resolvedFrameBorder,
            transform: [{ rotate: "45deg" }],
          }}
        />

        <View style={[baseSlotStyle, { top: 0, left: (size - bag) / 2 }]}>
          <BaseBag filled={onSecond} size={bag} occupiedColor={occupiedBaseColor} emptyColor={emptyColor} />
        </View>
        <View style={[baseSlotStyle, { bottom: 2, left: size * 0.06 }]}>
          <BaseBag filled={onThird} size={bag} occupiedColor={occupiedBaseColor} emptyColor={emptyColor} />
        </View>
        <View style={[baseSlotStyle, { bottom: 2, right: size * 0.06 }]}>
          <BaseBag filled={onFirst} size={bag} occupiedColor={occupiedBaseColor} emptyColor={emptyColor} />
        </View>
      </View>
    </View>
  );
}

export function MlbCountDisplay({
  balls = 0,
  strikes = 0,
  outs = 0,
  compact = false,
  activeColor = "#dc2626",
  emptyColor = "rgba(148,163,184,0.85)",
  labelColor = "#64748b",
  valueColor = "#0f172a",
  countColors = COUNT_COLORS,
  emptyFill,
}) {
  const dotSize = compact ? 7 : 8;
  const dotGap = compact ? 4 : 4;
  const labelSize = compact ? 11 : 12;
  const valueSize = compact ? 12 : 13;
  const labelWidth = compact ? 12 : 14;
  const dotsTrackWidth = dotSize * 3 + dotGap * 2;
  const valueWidth = compact ? 16 : 18;
  const rowGap = compact ? 5 : 6;

  const row = (labelKey, defaultLabel, filled, total, rowColor) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: rowGap,
      }}
    >
      <Text
        style={{
          color: labelColor,
          fontWeight: "900",
          fontSize: labelSize,
          width: labelWidth,
          letterSpacing: 0.3,
        }}
      >
        {i18n.t(labelKey, defaultLabel)}
      </Text>
      <View style={{ width: dotsTrackWidth }}>
        <CountDots
          filled={filled}
          total={total}
          activeColor={rowColor || activeColor}
          emptyColor={emptyColor}
          emptyFill={emptyFill}
          dotSize={dotSize}
        />
      </View>
      <Text
        style={{
          color: valueColor,
          fontWeight: "800",
          fontSize: valueSize,
          width: valueWidth,
          textAlign: "right",
          fontVariant: ["tabular-nums"],
        }}
      >
        {filled}
      </Text>
    </View>
  );

  return (
    <View style={{ gap: compact ? 4 : 5 }}>
      {row("live.mlb.ballsShort", "B", balls, 3, countColors.balls)}
      {row("live.mlb.strikesShort", "S", strikes, 2, countColors.strikes)}
      {row("live.mlb.outsShort", "O", outs, 2, countColors.outs)}
    </View>
  );
}

export default function MlbLiveSituation({
  game,
  colors,
  isDark,
  compact = false,
  light = false,
  showRunnersCount = false,
}) {
  const situation = mlbLiveSituation(game);
  if (!situation) return null;

  const palette = resolveSituationPalette({
    light,
    isDark: isDark ?? colors?.background === "#0b0f13",
    colors,
  });

  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: compact ? 8 : 10 }}>
      <View style={{ flexShrink: 0 }}>
        <MlbBaseDiamond
          onFirst={situation.onFirst}
          onSecond={situation.onSecond}
          onThird={situation.onThird}
          size={compact ? 40 : 46}
          occupiedBaseColor={palette.occupiedBaseColor}
          emptyColor={palette.emptyColor}
          light={light}
          compact={compact}
          frameBg={palette.frameBg}
          frameBorder={palette.frameBorder}
          infieldBg={palette.infieldBg}
        />
      </View>
      <View style={{ flexShrink: 0, zIndex: 2 }}>
        <MlbCountDisplay
          balls={situation.balls}
          strikes={situation.strikes}
          outs={situation.outs}
          compact={compact}
          activeColor={palette.activeColor}
          emptyColor={palette.emptyColor}
          labelColor={palette.labelColor}
          valueColor={palette.valueColor}
          countColors={palette.countColors}
          emptyFill={light ? "rgba(255,255,255,0.08)" : palette.emptyBaseFill}
        />
        {showRunnersCount && situation.runnersOnBase > 0 ? (
          <Text
            style={{
              color: palette.labelColor,
              fontSize: compact ? 11 : 12,
              fontWeight: "700",
              marginTop: 5,
            }}
          >
            {i18n.t("live.mlb.runnersOnBase", {
              defaultValue: "{{count}} coureur(s)",
              count: situation.runnersOnBase,
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (compact && !light && palette.outerBg) {
    return (
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderRadius: 12,
          backgroundColor: palette.outerBg,
          borderWidth: 2,
          borderColor: palette.outerBorder,
          overflow: "hidden",
        }}
      >
        {content}
      </View>
    );
  }

  return content;
}
