import React from "react";
import { View, Text, ScrollView } from "react-native";
import i18n from "@src/i18n/i18n";
import GroupPointsOverviewBlock from "@src/live/GroupPointsOverviewBlock";

export default function LivePointsOverviewPanel({ groupId, sport, colors }) {
  const t = i18n.t.bind(i18n);

  if (!groupId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.subtext, fontWeight: "700", textAlign: "center" }}>
          {t("live.selectGroupLabel")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 }}
      showsVerticalScrollIndicator={false}
    >
      <GroupPointsOverviewBlock groupId={groupId} sport={sport} colors={colors} variant="live" />
    </ScrollView>
  );
}
