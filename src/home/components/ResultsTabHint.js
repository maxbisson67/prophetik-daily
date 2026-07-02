import React from "react";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import i18n from "@src/i18n/i18n";
import { openMesResultatsTab } from "@src/defis/results/navigateToMesResultats";

export default function ResultsTabHint({ colors, style, groupId = null }) {
  const router = useRouter();
  const tabLabel = i18n.t("tabs.challenges", { defaultValue: "Mes résultats" });
  const linkColor = colors?.primary || "#b91c1c";

  const onPressLink = () => {
    openMesResultatsTab(router, { groupId });
  };

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
        {i18n.t("home.resultsTabHintPrefix", {
          defaultValue: "Consulte les résultats dans l'onglet ",
        })}
        <Text onPress={onPressLink} style={{ color: linkColor, fontWeight: "900" }}>
          {i18n.t("home.resultsTabHintLink", {
            defaultValue: tabLabel,
          })}
        </Text>
        {i18n.t("home.resultsTabHintSuffix", { defaultValue: "." })}
      </Text>
    </View>
  );
}
