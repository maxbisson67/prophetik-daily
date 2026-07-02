import React from "react";
import { View } from "react-native";
import SportGlyph from "@src/sports/SportGlyph";

export function resolveDefiItemSport(item) {
  const raw = item?.raw || {};
  return raw.league || raw.sport || "NHL";
}

export default function DefiTypeLeading({ sport, colors, glyphSize = 22 }) {
  return (
    <View style={{ marginRight: 8 }}>
      <SportGlyph sport={sport} colors={colors} size={glyphSize} />
    </View>
  );
}
