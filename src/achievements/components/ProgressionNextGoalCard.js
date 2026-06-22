import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import {
  ProphetikProgressBar,
  PROPHETIK_RED,
  prophetikCardShadow,
  prophetikSectionCardStyle,
} from "./prophetikCardStyles.js";

export default function ProgressionNextGoalCard({ colors, nextGoal }) {
  if (!nextGoal?.def) {
    return (
      <View style={prophetikCardShadow()}>
        <View style={prophetikSectionCardStyle(colors)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 18 }}>🎯</Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, letterSpacing: 0.8 }}>
              {i18n.t("progression.nextGoal.title", { defaultValue: "PROCHAIN OBJECTIF" }).toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: "600" }}>
            {i18n.t("progression.nextGoal.allUnlocked", {
              defaultValue: "Tous les badges MVP sont débloqués — bravo !",
            })}
          </Text>
        </View>
      </View>
    );
  }

  const { def, current, threshold, pct } = nextGoal;
  const name = i18n.t(`progression.badges.${def.id}.name`, { defaultValue: def.id });

  return (
    <View style={prophetikCardShadow()}>
      <View style={prophetikSectionCardStyle(colors)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Text style={{ fontSize: 18 }}>🎯</Text>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, letterSpacing: 0.8 }}>
            {i18n.t("progression.nextGoal.title", { defaultValue: "PROCHAIN OBJECTIF" }).toUpperCase()}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(185,28,28,0.12)",
              borderWidth: 1,
              borderColor: "rgba(185,28,28,0.25)",
            }}
          >
            <MaterialCommunityIcons name={def.icon} size={22} color={PROPHETIK_RED} />
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{name}</Text>
            <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 13 }}>
              {i18n.t("progression.progress", {
                current,
                threshold,
                defaultValue: `${current}/${threshold}`,
              })}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14, gap: 6 }}>
          <ProphetikProgressBar pct={pct} colors={colors} />
          <Text
            style={{
              color: colors.subtext,
              fontSize: 11,
              fontWeight: "700",
              textAlign: "right",
            }}
          >
            {pct} %
          </Text>
        </View>
      </View>
    </View>
  );
}
