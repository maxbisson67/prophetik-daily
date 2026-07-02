import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import i18n from "@src/i18n/i18n";
import { useTheme } from "@src/theme/ThemeProvider";
import { RESULTS_ACCENT, getResultsIntroBandStyle } from "@src/defis/results/resultsTheme";

export default function ResultsContextBanner({ colors }) {
  const router = useRouter();
  const { isDark } = useTheme();
  const bandStyle = getResultsIntroBandStyle(isDark);

  return (
    <View
      style={{
        ...bandStyle,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: bandStyle.borderBottomColor,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Ionicons name="stats-chart" size={22} color={RESULTS_ACCENT} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
            {i18n.t("challenges.resultsContextTitle", {
              defaultValue: "Consultation des résultats",
            })}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 4, lineHeight: 19, fontSize: 13 }}>
            {i18n.t("challenges.resultsContextHint", {
              defaultValue:
                "Tu es dans Mes résultats. Pour participer aux défis du jour, va sur l’onglet Accueil.",
            })}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(drawer)/(tabs)/AccueilScreen")}
            activeOpacity={0.85}
            style={{
              alignSelf: "flex-start",
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: RESULTS_ACCENT,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
            }}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
              {i18n.t("challenges.goToAccueil", {
                defaultValue: "Participer aux défis du jour",
              })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
