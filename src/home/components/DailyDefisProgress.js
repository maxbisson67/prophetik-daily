import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import { PROPHETIK_RED, HOME_SPACING } from "@src/achievements/components/prophetikCardStyles";

export default function DailyDefisProgress({ enrolledCount, colors }) {
  const total = 3;
  const count = Math.max(0, Math.min(total, Number(enrolledCount) || 0));

  return (
    <View
      style={{
        width: "100%",
        marginTop: HOME_SPACING.sm,
        marginBottom: HOME_SPACING.sm,
      }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              backgroundColor: index < count ? PROPHETIK_RED : colors.card2,
              borderWidth: 1,
              borderColor: index < count ? PROPHETIK_RED : colors.border,
            }}
          />
        ))}
      </View>
      <Text
        style={{
          color: colors.subtext,
          fontWeight: "800",
          fontSize: 12,
          textAlign: "center",
          marginTop: HOME_SPACING.sm,
        }}
      >
        {i18n.t("home.dailyDefisProgress", {
          count,
          total,
          defaultValue: "{{count}} / {{total}} défis inscrits",
        })}
      </Text>
    </View>
  );
}
