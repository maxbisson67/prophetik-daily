import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";

export default function LiveViewModeToggle({ value, onChange, colors }) {
  const t = i18n.t.bind(i18n);
  const modes = [
    {
      key: "points",
      label: t("live.viewMode.points", { defaultValue: "Points" }),
    },
    {
      key: "games",
      label: t("live.viewMode.games", { defaultValue: "Matchs" }),
    },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        marginTop: 10,
        marginBottom: 4,
        padding: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
      }}
    >
      {modes.map((mode) => {
        const active = value === mode.key;
        return (
          <TouchableOpacity
            key={mode.key}
            onPress={() => onChange(mode.key)}
            activeOpacity={0.85}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: active ? colors.primary : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? "#fff" : colors.text,
                fontWeight: "900",
                fontSize: 13,
              }}
            >
              {mode.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
