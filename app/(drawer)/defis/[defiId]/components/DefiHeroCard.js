import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

export default function DefiHeroCard({ title, gameDayStr, pot }) {
  const { colors } = useTheme();

  const header =
    title ||
    i18n.t("defi.infoCard.trioTitle", { defaultValue: "Trio du jour" });

  const potLabel = i18n.t("defi.infoCard.pot", {
    count: pot ?? 0,
    defaultValue: "{{count}} point(s)",
  });

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

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="trophy-outline" size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
          {i18n.t("defi.infoCard.potLabel", { defaultValue: "Cagnotte" })}
          {" · "}
          {potLabel}
        </Text>
      </View>
    </View>
  );
}
