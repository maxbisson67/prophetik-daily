import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";

function resolveSituationPalette({ light, isDark, colors }) {
  if (light) {
    return {
      frameBg: "rgba(255,255,255,0.16)",
      frameBorder: "rgba(255,255,255,0.32)",
      infieldBg: "rgba(255,255,255,0.1)",
      activeColor: "#fecaca",
      emptyColor: "rgba(255,255,255,0.72)",
      emptyBaseFill: "rgba(255,255,255,0.12)",
      labelColor: "rgba(255,255,255,0.75)",
      valueColor: "#f8fafc",
      outerBg: null,
      outerBorder: null,
    };
  }

  if (isDark === false) {
    return {
      frameBg: "#dcfce7",
      frameBorder: "#4ade80",
      infieldBg: "rgba(22,163,74,0.22)",
      activeColor: "#dc2626",
      emptyColor: "#475569",
      emptyBaseFill: "rgba(71,85,105,0.14)",
      labelColor: colors?.subtext || "#64748b",
      valueColor: colors?.text || "#0f172a",
      outerBg: "#f0fdf4",
      outerBorder: "#86efac",
    };
  }

  return {
    frameBg: colors?.background || "#0b0f13",
    frameBorder: colors?.border || "#1f2937",
    infieldBg: "rgba(34,197,94,0.18)",
    activeColor: colors?.primary || "#ef4444",
    emptyColor: colors?.subtext || "#9ca3af",
    emptyBaseFill: "rgba(148,163,184,0.12)",
    labelColor: colors?.subtext || "#9ca3af",
    valueColor: colors?.text || "#e5e7eb",
    outerBg: colors?.background || "#0b0f13",
    outerBorder: colors?.border || "#1f2937",
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

function CountDots({ filled, total, activeColor, emptyColor, dotSize = 6 }) {
  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: i < filled ? activeColor : "transparent",
            borderWidth: 1,
            borderColor: i < filled ? activeColor : emptyColor,
          }}
        />
      ))}
    </View>
  );
}

function BaseBag({ filled, size, activeColor, emptyColor, emptyBaseFill }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: filled ? activeColor : emptyBaseFill || "transparent",
        borderWidth: filled ? 1.5 : 2,
        borderColor: filled ? activeColor : emptyColor,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

export function MlbBaseDiamond({
  onFirst = false,
  onSecond = false,
  onThird = false,
  size = 40,
  activeColor = "#dc2626",
  emptyColor = "rgba(148,163,184,0.85)",
  emptyBaseFill = "transparent",
  light = false,
  compact = false,
  frameBg,
  frameBorder,
  infieldBg,
}) {
  const bag = Math.max(8, size * 0.24);
  const pad = compact ? 5 : 7;
  const frameSize = size + pad * 2;

  const resolvedFrameBg = frameBg ?? (light ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.06)");
  const resolvedFrameBorder = frameBorder ?? (light ? "rgba(255,255,255,0.32)" : "rgba(148,163,184,0.45)");
  const resolvedInfieldBg = infieldBg ?? (light ? "rgba(255,255,255,0.1)" : "rgba(34,197,94,0.12)");

  return (
    <View
      style={{
        width: frameSize,
        height: frameSize,
        borderRadius: compact ? 10 : 12,
        backgroundColor: resolvedFrameBg,
        borderWidth: 1.5,
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

        <View style={{ position: "absolute", top: 0, left: (size - bag) / 2 }}>
          <BaseBag
            filled={onSecond}
            size={bag}
            activeColor={activeColor}
            emptyColor={emptyColor}
            emptyBaseFill={emptyBaseFill}
          />
        </View>
        <View style={{ position: "absolute", bottom: 2, left: size * 0.06 }}>
          <BaseBag
            filled={onThird}
            size={bag}
            activeColor={activeColor}
            emptyColor={emptyColor}
            emptyBaseFill={emptyBaseFill}
          />
        </View>
        <View style={{ position: "absolute", bottom: 2, right: size * 0.06 }}>
          <BaseBag
            filled={onFirst}
            size={bag}
            activeColor={activeColor}
            emptyColor={emptyColor}
            emptyBaseFill={emptyBaseFill}
          />
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
}) {
  const dotSize = compact ? 5 : 6;

  const row = (labelKey, defaultLabel, filled, total) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text style={{ color: labelColor, fontWeight: "800", fontSize: compact ? 9 : 10, width: 10 }}>
        {i18n.t(labelKey, defaultLabel)}
      </Text>
      <CountDots
        filled={filled}
        total={total}
        activeColor={activeColor}
        emptyColor={emptyColor}
        dotSize={dotSize}
      />
      {!compact ? (
        <Text style={{ color: valueColor, fontWeight: "700", fontSize: 11, minWidth: 10 }}>
          {filled}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: compact ? 3 : 4 }}>
      {row("live.mlb.ballsShort", "B", balls, 3)}
      {row("live.mlb.strikesShort", "S", strikes, 2)}
      {row("live.mlb.outsShort", "O", outs, 2)}
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: compact ? 8 : 12 }}>
      <MlbBaseDiamond
        onFirst={situation.onFirst}
        onSecond={situation.onSecond}
        onThird={situation.onThird}
        size={compact ? 34 : 44}
        activeColor={palette.activeColor}
        emptyColor={palette.emptyColor}
        emptyBaseFill={palette.emptyBaseFill}
        light={light}
        compact={compact}
        frameBg={palette.frameBg}
        frameBorder={palette.frameBorder}
        infieldBg={palette.infieldBg}
      />
      <View>
        <MlbCountDisplay
          balls={situation.balls}
          strikes={situation.strikes}
          outs={situation.outs}
          compact={compact}
          activeColor={palette.activeColor}
          emptyColor={palette.emptyColor}
          labelColor={palette.labelColor}
          valueColor={palette.valueColor}
        />
        {showRunnersCount && situation.runnersOnBase > 0 ? (
          <Text
            style={{
              color: palette.labelColor,
              fontSize: 10,
              fontWeight: "700",
              marginTop: 4,
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
          borderWidth: 1.5,
          borderColor: palette.outerBorder,
        }}
      >
        {content}
      </View>
    );
  }

  return content;
}
