import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

export default function LiveChallengesLegend({ colors }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View
      style={{
        marginTop: 12,
        marginBottom: 4,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded((open) => !open)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 13,
            fontWeight: "800",
          }}
        >
          {i18n.t("live.legend.title", {
            defaultValue: "Suivre mes prédictions",
          })}
        </Text>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {expanded ? (
        <Text
          style={{
            color: colors.subtext,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "600",
            marginTop: 10,
          }}
        >
          {i18n.t("live.legend.intro", {
            defaultValue:
              "Suivre la performance de vos choix dans les matchs en surbrillance. Bonne chance!",
          })}
        </Text>
      ) : null}
    </View>
  );
}
