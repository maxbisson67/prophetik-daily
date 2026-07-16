import React from "react";
import { View } from "react-native";
import SportGlyph from "@src/sports/SportGlyph";
import LiveChallengeKindBadge from "@src/live/LiveChallengeKindBadge";

export function resolveDefiItemSport(item) {
  const raw = item?.raw || {};
  return raw.league || raw.sport || "NHL";
}

export default function DefiTypeLeading({ kind, sport, colors, glyphSize = 22, compact = true }) {
  const challengeKind = String(kind || "").toLowerCase();

  if (challengeKind === "fgc" || challengeKind === "tp" || challengeKind === "ts") {
    return (
      <View style={{ marginRight: 8 }}>
        <LiveChallengeKindBadge
          kind={challengeKind}
          colors={colors}
          sport={sport}
          compact={compact}
        />
      </View>
    );
  }

  return (
    <View style={{ marginRight: 8 }}>
      <SportGlyph sport={sport} colors={colors} size={glyphSize} />
    </View>
  );
}
