// app/defis/[defiId]/components/ImpactBadge.js
import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";
import { impactPct } from "../utils/defiFormatters";

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

/**
 * ProgressBar (0..1) avec un curseur (dot) qui se place sur la track.
 * - fillColor: couleur de la barre (rouge/vert)
 * - trackColor: couleur de fond
 */
function ProgressWithCursor({
  value = 0, // 0..1
  fillColor,
  trackColor,
  height = 8,
  cursorSize = 12,
}) {
  const v = clamp(Number(value) || 0, 0, 1);
  const leftPct = `${v * 100}%`;

  return (
    <View
      style={{
        position: "relative",
        width: "100%",
        height: Math.max(height, cursorSize),
        justifyContent: "center",
      }}
    >
      {/* track */}
      <View
        style={{
          height,
          borderRadius: 999,
          backgroundColor: trackColor,
          overflow: "hidden",
        }}
      >
        {/* fill */}
        <View
          style={{
            width: leftPct,
            height: "100%",
            backgroundColor: fillColor,
          }}
        />
      </View>

      {/* cursor */}
      <View
        style={{
          position: "absolute",
          left: leftPct,
          top: "50%",
          width: cursorSize,
          height: cursorSize,
          borderRadius: cursorSize / 2,
          backgroundColor: fillColor,
          borderWidth: 2,
          borderColor: "#fff",
          transform: [{ translateX: -cursorSize / 2 }, { translateY: -cursorSize / 2 }],
        }}
      />
    </View>
  );
}

export default function ImpactBadge({
  coeff,
  tierLower = "free",
  rangePct = 10,      // ✅ 10 => 6.9% devient 69%
  align = "left",     // "left" | "right" (utile dans MatchupRow)
}) {
  const { colors } = useTheme();

  const tier = String(tierLower || "free").toLowerCase();
  const isVip = tier === "vip";
  const isPro = tier === "pro" || isVip;

  const pct = impactPct(coeff); // ex: -6.9
  const absPct = Math.abs(Number(pct) || 0);

  // ✅ mapping vers 0..1 puis 0..100
  const progress = clamp(absPct / (Number(rangePct) || 10), 0, 1);
  const progress100 = Math.round(progress * 100);

  const sign = Number(pct) || 0;
  const isUp = sign > 0.0001;
  const isDown = sign < -0.0001;

  // Couleurs (rouge/vert selon coeff)
  const fillColor = isUp ? "#16a34a" : isDown ? "#ef4444" : colors.subtext;
  const trackColor = colors.border; // sobre, match ton UI

  const isFr = String(i18n.locale || "").toLowerCase().startsWith("fr");
  const shortLabel = isUp ? (isFr ? "Fav." : "Fav.") : isDown ? (isFr ? "T." : "T.") : (isFr ? "N." : "N.");

  const trendIcon = isUp ? "trending-up" : isDown ? "trending-down" : "remove";

  const showTooltip = () => {
    const msgFr =
      "Cette barre montre la difficulté relative du matchup.\n\n" +
      `Échelle: 0 → ${rangePct}%.\n` +
      `Ex: impact ${absPct.toFixed(1)}% => ${progress100}% sur l’échelle.\n\n` +
      "Le coeff est un multiplicateur basé sur l’adversaire (buts alloués / match + différentiel) + léger bonus domicile.\n" +
      "Vert = matchup favorable • Rouge = matchup difficile.";
    const msgEn =
      "This bar shows matchup difficulty.\n\n" +
      `Scale: 0 → ${rangePct}%.\n` +
      `Example: impact ${absPct.toFixed(1)}% => ${progress100}% on the scale.\n\n` +
      "Coeff is a multiplier based on opponent (goals allowed per game + goal differential) + small home-ice bonus.\n" +
      "Green = favorable • Red = tough.";

    Alert.alert(isFr ? "Impact" : "Impact", isFr ? msgFr : msgEn, [
      { text: i18n.t("common.ok", { defaultValue: "OK" }) },
    ]);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minWidth: 0,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        gap: 8,
      }}
    >
      {/* bloc texte + barre */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <ProgressWithCursor
          value={progress}
          fillColor={fillColor}
          trackColor={trackColor}
          height={8}
          cursorSize={12}
        />

        {/* ligne label compacte */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, minWidth: 0 }}>
          <Ionicons name={trendIcon} size={16} color={fillColor} />
          <Text
            numberOfLines={1}
            style={{
              marginLeft: 6,
              color: colors.subtext,
              fontWeight: "900",
              flexShrink: 1,
            }}
          >
            {/* ✅ Pro: tu peux garder le % réel, sinon juste un label */}
            {isPro ? `${shortLabel} (${sign >= 0 ? "+" : ""}${absPct.toFixed(1)}%)` : shortLabel}
          </Text>

          {/* Optionnel: afficher le % sur l’échelle (69%) si tu veux */}
          {/* <Text style={{ marginLeft: 6, color: colors.subtext, fontWeight: "800" }}>{progress100}%</Text> */}
        </View>
      </View>

      {/* info (VIP) */}
      {isVip ? (
        <TouchableOpacity onPress={showTooltip} style={{ padding: 4 }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.subtext} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}