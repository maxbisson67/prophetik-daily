import React from "react";
import { View, Text } from "react-native";
import MatchTaskStatusChip from "@src/defis/match/MatchTaskStatusChip";

/** Heure + statut empilés à droite du matchup (2 lignes max, compact). */
export default function TpMatchMetaColumn({
  colors,
  startTimeLabel = null,
  showStartTime = false,
  matchTask = null,
}) {
  if (!showStartTime && !matchTask) return null;

  return (
    <View
      style={{
        alignItems: showStartTime ? "center" : "flex-end",
        alignSelf: showStartTime ? "flex-start" : "center",
        flexShrink: 0,
        gap: 4,
      }}
    >
      {showStartTime && startTimeLabel ? (
        <Text
          style={{
            color: colors.subtext,
            fontWeight: "700",
            fontSize: 13,
            fontVariant: ["tabular-nums"],
          }}
          numberOfLines={1}
        >
          {startTimeLabel}
        </Text>
      ) : null}

      {matchTask ? <MatchTaskStatusChip task={matchTask} colors={colors} compact /> : null}
    </View>
  );
}
