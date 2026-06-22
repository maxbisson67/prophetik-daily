import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatParticipantProgressHint,
  formatParticipantTaskLabel,
  getParticipantTaskStatusUi,
} from "@src/defis/participant/participantTaskStatus";

export default function ParticipantTaskStatusChip({ task, colors, compact = false }) {
  if (!task) return null;

  const ui = getParticipantTaskStatusUi(task.state);
  const label = formatParticipantTaskLabel(task);
  const hint = formatParticipantProgressHint(task);

  return (
    <View style={{ alignItems: "flex-end", maxWidth: compact ? "48%" : "52%" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: compact ? 8 : 10,
          paddingVertical: compact ? 4 : 5,
          borderRadius: 999,
          backgroundColor: ui.bg,
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

      {hint ? (
        <Text
          style={{
            marginTop: 4,
            color: colors?.subtext || "#6b7280",
            fontSize: 11,
            fontWeight: "600",
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
