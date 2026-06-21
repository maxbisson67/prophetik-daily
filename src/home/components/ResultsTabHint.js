import React from "react";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

export default function ResultsTabHint({ colors, style }) {
  const tabLabel = i18n.t("tabs.challenges", { defaultValue: "Mes résultats" });

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="information-outline"
        size={16}
        color={colors.subtext}
        style={{ marginTop: 1 }}
      />
      <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 18, flex: 1 }}>
        {i18n.t("home.resultsTabHint", {
          defaultValue: "Consulte les résultats dans l'onglet {{tab}}.",
          tab: tabLabel,
        })}
      </Text>
    </View>
  );
}
