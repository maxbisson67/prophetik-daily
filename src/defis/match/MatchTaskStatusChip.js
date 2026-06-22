import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatMatchTaskLabel,
  getMatchTaskStatusUi,
} from "@src/defis/match/matchTaskStatus";

export default function MatchTaskStatusChip({ task, colors, compact = false }) {
  if (!task?.state) return null;

  const ui = getMatchTaskStatusUi(task.state);
  const label = formatMatchTaskLabel(task);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 4 : 5,
        borderRadius: 999,
        backgroundColor: ui.bg,
        flexShrink: 0,
      }}
    >
      <Ionicons name={ui.icon} size={compact ? 12 : 14} color={ui.color} />
      <Text
        style={{
          marginLeft: 5,
          color: ui.color,
          fontWeight: "800",
          fontSize: compact ? 11 : 12,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
