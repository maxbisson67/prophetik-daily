// src/ui/ProphetikIcons.js
import React, { useMemo } from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";

/**
 * Assets (exemples) — ajuste les paths/fichiers selon tes assets réels.
 * Idée: on centralise ici tous les icônes/badges utilisés par l'app.
 */

// Logo Prophetik (utilisé pour "points")
const P_DARK = require("./prophetik_icon_512.png");
const P_LIGHT = require("./prophetik_icon_512_white.png");

// Badges abonnements (exemples)
const SUB_FREE = require("./sub_free.png");
const SUB_PRO = require("./sub_pro.png");
const SUB_VIP = require("./sub_vip.png");


// Badges sports (exemples)
const SPORT_HOCKEY = require("./sport_hockey.png");
const SPORT_BASEBALL = require("./sport_baseball.png");

// Badge IA (exemples)
const AI_BADGE = require("./ai.png");

/**
 * Props:
 * - mode: "points" | "badge"   (points = nombre + logo, badge = icône seule par défaut)
 * - variant:
 *    - points: "prophetik"
 *    - badge: "free" | "starter" | "pro" | "hockey" | "baseball" | "ai"
 * - amount: number|string (seulement pour mode="points")
 */
export default function ProphetikIcons({
  mode = "points",
  variant = "prophetik",

  // ✅ nouveau
  emoji,

  amount,
  size = "md",
  showIcon = true,
  iconOnly = false,
  prefixPlus = false,
  iconPosition = "after",
  label,
  labelStyle,
  forceTone,
  style,
  textStyle,
  iconStyle,
}) {
  const { colors, isDark } = useTheme();

  const isEmoji = mode === "emoji" && typeof emoji === "string" && !!emoji.trim();


  const cfg = useMemo(() => {
    const map = {
      sm: { icon: 16, font: 13, gap: 6 },
      md: { icon: 20, font: 15, gap: 8 },
      lg: { icon: 26, font: 18, gap: 10 },
      xl: { icon: 34, font: 22, gap: 12 },
      xxl: { icon: 48, font: 26, gap: 14},
    };
    return map[size] || map.md;
  }, [size]);

  const resolvedIsDark = useMemo(() => {
    if (forceTone === "dark") return true;
    if (forceTone === "light") return false;
    return !!isDark;
  }, [forceTone, isDark]);



  const displayAmount = useMemo(() => {
    if (amount === null || amount === undefined || amount === "") return "";
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount);
    return `${prefixPlus && n > 0 ? "+" : ""}${n}`;
  }, [amount, prefixPlus]);

  const source = useMemo(() => {
    if (mode === "points") return resolvedIsDark ? P_LIGHT : P_DARK;

    if (mode === "emoji") return null;

    const badgeMap = {
      free: SUB_FREE,
      vip: SUB_VIP,
      pro: SUB_PRO,
      hockey: SPORT_HOCKEY,
      baseball: SPORT_BASEBALL,
      ai: AI_BADGE,
    };
    return badgeMap[variant] || AI_BADGE;
  }, [mode, variant, resolvedIsDark]);


  const shouldShowText =
    !iconOnly &&
    (
      (mode === "points" && displayAmount !== "") ||
      (mode === "badge" && !!label) ||
      (mode === "emoji" && displayAmount !== "")
    );

  const textToShow =
    mode === "points" ? displayAmount :
    mode === "badge" ? label :
    mode === "emoji" ? displayAmount :
    "";

return (
    <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>
      {/* Icon BEFORE */}
      {showIcon && iconPosition === "before" && (
        isEmoji ? (
        <Text style={{ fontSize: cfg.icon, marginRight: cfg.gap }}>
          {emoji}
        </Text>
        ) : (
        <Image
          source={source}
          resizeMode="contain"
          style={[{ width: cfg.icon, height: cfg.icon }, iconStyle]}
        />
        )
      )}

      {/* Label */}
      {shouldShowText && (
        <Text
          style={[
            {
              marginHorizontal: showIcon ? cfg.gap : 0,
              fontSize: cfg.font,
              fontWeight: "800",
              color: colors.text,
              ...(mode === "points" ? { fontVariant: ["tabular-nums"] } : null),
            },
            textStyle,
            labelStyle,
          ]}
        >
          {textToShow}
        </Text>
      )}

      {/* Icon AFTER */}
      {showIcon && iconPosition === "after" && (
        isEmoji ? (
          <Text style={[{ fontSize: cfg.icon, lineHeight: cfg.icon + 2 }, iconStyle]}>
            {emoji}
          </Text>
        ) : (
          <Image
            source={source}
            resizeMode="contain"
            style={[{ width: cfg.icon, height: cfg.icon }, iconStyle]}
          />
        )
      )}
    </View>
  );
}
