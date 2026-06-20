import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import { groupAchievementsByCategory } from "../progressionUtils.js";
import BadgeTile from "./BadgeTile.js";

export default function BadgesGrid({ stats, achievements, colors, compact = false }) {
  const sections = groupAchievementsByCategory();

  return (
    <View style={{ gap: compact ? 12 : 16 }}>
      {sections.map(({ category, items }) => (
        <View key={category} style={{ gap: 8 }}>
          {!compact ? (
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
              {i18n.t(`progression.categories.${category}`, {
                defaultValue: category,
              })}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {items.map((def) => (
              <View key={def.id} style={{ width: compact ? "31%" : "48%" }}>
                <BadgeTile
                  def={def}
                  stats={stats}
                  achievements={achievements}
                  colors={colors}
                  compact={compact}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
