// src/leaderboard/Segmented.js
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function Segmented({ value, onChange, items, colors, style }) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: colors.card,
          minWidth: 220,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      {items.map((it) => {
        const active = value === it.value;
        return (
          <TouchableOpacity
            key={it.value}
            onPress={() => onChange(it.value)}
            activeOpacity={0.85}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.primary : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? "#fff" : colors.subtext,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {it.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}