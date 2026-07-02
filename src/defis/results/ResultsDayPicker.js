import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import i18n from "@src/i18n/i18n";
import { RESULTS_ACCENT } from "@src/defis/results/resultsTheme";

export default function ResultsDayPicker({ colors, days = [], value, onChange, accentColor = RESULTS_ACCENT }) {
  if (!days.length) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <Text
        style={{
          color: colors.subtext,
          fontSize: 11,
          fontWeight: "800",
          marginBottom: 8,
          paddingHorizontal: 2,
        }}
      >
        {i18n.t("challenges.selectDayLabel", {
          defaultValue: "Sélectionne une journée",
        })}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {days.map((day) => {
          const active = value === day.ymd;

          return (
            <TouchableOpacity
              key={day.ymd}
              onPress={() => onChange?.(day.ymd)}
              activeOpacity={0.85}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: active ? accentColor : colors.border,
                backgroundColor: active ? accentColor : colors.card2,
              }}
            >
              <Text
                style={{
                  color: active ? "#fff" : colors.text,
                  fontWeight: "900",
                  fontSize: 13,
                }}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
