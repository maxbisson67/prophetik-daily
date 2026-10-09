import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

export default function DefiHeroCard({ title, gameDayStr }) {
  const { colors } = useTheme();

  const header =
    title ||
    i18n.t("defi.infoCard.trioTitle", { defaultValue: "Trio du jour" });

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 14,
        gap: 10,
      }}
    >
      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
        {header}
      </Text>

      <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 15 }}>
        {gameDayStr || "—"}
      </Text>
    </View>
  );
}
