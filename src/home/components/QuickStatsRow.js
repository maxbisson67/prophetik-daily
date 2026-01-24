import React, { useMemo } from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import ProphetikIcons from "@src/ui/ProphetikIcons";

export default function QuickStatsRow({ colors, activeDefis }) {
  const { activeCount, totalPot } = useMemo(() => {
    const list = Array.isArray(activeDefis) ? activeDefis : [];
    return {
      activeCount: list.length,
      totalPot: list.reduce((sum, d) => sum + Number(d?.pot || 0), 0),
    };
  }, [activeDefis]);

  return (
    <View
      style={{
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        {/* Défis actifs */}
        <View
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.subtext }}>
            {i18n.t("home.activeChallenges")}
          </Text>
          <View style={{ marginTop: 6 }}>
            <ProphetikIcons mode="emoji" emoji="🎯" amount={activeCount} size="lg" iconPosition="after" />
          </View>
          

        </View>

        {/* Cagnotte totale */}
        <View
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.subtext }}>
            {i18n.t("home.totalPot")}
          </Text>
          <View style={{ marginTop: 6 }}>
            <ProphetikIcons amount={totalPot} size="lg" iconPosition="after" />
          </View>
        </View>
      </View>
    </View>
  );
}