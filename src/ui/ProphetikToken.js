// src/ui/ProphetikToken.js
import React, { useMemo } from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";

// =============================
// Prophetik Token Assets
// =============================
const TOKEN_IMG_DARK = require("./prophetik_icon_512.png");        // noir
const TOKEN_IMG_LIGHT = require("./prophetik_icon_512_white.png"); // blanc

export default function ProphetikToken({
  amount,
  size = "md",
  variant = "flat",
  showIcon = true,
  iconOnly = false,
  prefixPlus = false,
  iconPosition = "before",
  style,
  textStyle,
  iconStyle,
}) {
  const { colors, isDark } = useTheme();

  // -----------------------------
  // Sizing
  // -----------------------------
  const cfg = useMemo(() => {
    const map = {
      sm: { icon: 16, font: 13, gap: 6 },
      md: { icon: 20, font: 15, gap: 8 },
      lg: { icon: 26, font: 18, gap: 10 },
    };
    return map[size] || map.md;
  }, [size]);

  // -----------------------------
  // Amount
  // -----------------------------
  const displayAmount = useMemo(() => {
    if (amount === null || amount === undefined || amount === "") return "";
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount);
    return `${prefixPlus && n > 0 ? "+" : ""}${n}`;
  }, [amount, prefixPlus]);

  // -----------------------------
  // Correct icon (no contrast bg)
  // -----------------------------
  const tokenSource = isDark ? TOKEN_IMG_LIGHT : TOKEN_IMG_DARK;

  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center" },
        style,
      ]}
    >
      {/* ICON BEFORE */}
      {showIcon && iconPosition === "before" && (
        <Image
          source={tokenSource}
          resizeMode="contain"
          style={[
            { width: cfg.icon, height: cfg.icon },
            iconStyle,
          ]}
        />
      )}

      {/* AMOUNT */}
      {!iconOnly && (
        <Text
          style={[
            {
              marginHorizontal: showIcon ? cfg.gap : 0,
              fontSize: cfg.font,
              fontWeight: "800",
              color: colors.text,
              fontVariant: ["tabular-nums"],
            },
            textStyle,
          ]}
        >
          {displayAmount}
        </Text>
      )}

      {/* ICON AFTER */}
      {showIcon && iconPosition === "after" && (
        <Image
          source={tokenSource}
          resizeMode="contain"
          style={[
            { width: cfg.icon, height: cfg.icon },
            iconStyle,
          ]}
        />
      )}
    </View>
  );
}