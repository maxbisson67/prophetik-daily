// app/defis/[defiId]/components/TeamMetaBadge.js
import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

function isFrench() {
  return String(i18n.locale || "").toLowerCase().startsWith("fr");
}

function ordinalFr(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "—";
  // 1er / 2e / 3e …
  return x === 1 ? "1er" : `${x}e`;
}

function ordinalEn(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "—";
  const j = x % 10;
  const k = x % 100;
  if (j === 1 && k !== 11) return `${x}st`;
  if (j === 2 && k !== 12) return `${x}nd`;
  if (j === 3 && k !== 13) return `${x}rd`;
  return `${x}th`;
}

function fmtRank(n) {
  return isFrench() ? ordinalFr(n) : ordinalEn(n);
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function TeamMetaBadge({
  rankOverall,
  goalDifferential,
  compact = true, // conservé pour compat
}) {
  const { colors } = useTheme();

  const rank = numOrNull(rankOverall);
  const gd = numOrNull(goalDifferential);

  const trend = useMemo(() => {
    if (gd == null) return "flat";
    if (gd > 0) return "up";
    if (gd < 0) return "down";
    return "flat";
  }, [gd]);

  const icon =
    trend === "up"
      ? "trending-up"
      : trend === "down"
      ? "trending-down"
      : "remove";

  const fg =
    trend === "up"
      ? "#16a34a"
      : trend === "down"
      ? "#ef4444"
      : colors.subtext;

  // ✅ i18n labels (plus de "Rank" hardcodé)
  const labelRank = i18n.t("defi.matchup.rankShort", { defaultValue: "Rank" });
  const labelGd = i18n.t("defi.matchup.diffShort", { defaultValue: "+/-" });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={16} color={fg} />

      <Text
        style={{
          color: colors.subtext,
          fontSize: 12,
          fontWeight: "900",
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {labelRank}: {rank == null ? "—" : fmtRank(rank)}, {labelGd}:{" "}
        {gd == null ? "—" : gd}
      </Text>
    </View>
  );
}