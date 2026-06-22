import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import { groupBadgesForDisplay } from "../badgeDisplaySections.js";
import BadgeTile from "./BadgeTile.js";
import { prophetikCardShadow, prophetikSectionCardStyle } from "./prophetikCardStyles.js";

export default function BadgesGrid({ stats, achievements, colors, compact = false }) {
  const sections = groupBadgesForDisplay();

  if (compact) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {sections.flatMap((section) =>
          section.items.map((def) => (
            <View key={def.id} style={{ width: "31%" }}>
              <BadgeTile
                def={def}
                stats={stats}
                achievements={achievements}
                colors={colors}
                compact
              />
            </View>
          ))
        )}
      </View>
    );
  }

  return (
    <View style={prophetikCardShadow()}>
      <View style={[prophetikSectionCardStyle(colors), { gap: 20 }]}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {i18n.t("progression.badgesTitle", { defaultValue: "Badges" })}
        </Text>

        {sections.map((section, sectionIndex) => (
          <View
            key={section.id}
            style={{
              gap: 12,
              paddingTop: sectionIndex > 0 ? 4 : 0,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>{section.emoji}</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15, letterSpacing: 0.4 }}>
                {i18n.t(section.titleKey, { defaultValue: section.defaultTitle })}
              </Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {section.items.map((def) => (
                <View key={def.id} style={{ width: "48%" }}>
                  <BadgeTile
                    def={def}
                    stats={stats}
                    achievements={achievements}
                    colors={colors}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
