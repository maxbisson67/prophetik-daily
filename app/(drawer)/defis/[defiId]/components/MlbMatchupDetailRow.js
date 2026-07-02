import React from "react";
import { View, Text } from "react-native";
import i18n from "@src/i18n/i18n";
import {
  formatMlbPitcherEraLine,
  formatMlbPitcherFallbackLabel,
  formatMlbPitcherNameAndRecord,
} from "@src/mlb/mlbPitcherDisplayHelpers";

function PitcherBlock({ pitcher, colors, align = "center" }) {
  const nameLine = formatMlbPitcherNameAndRecord(pitcher);
  const eraLine = formatMlbPitcherEraLine(pitcher);
  const textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";

  if (!nameLine) {
    return (
      <Text
        style={{
          color: colors.subtext,
          fontSize: 11,
          fontWeight: "700",
          textAlign,
          marginTop: 4,
        }}
      >
        {formatMlbPitcherFallbackLabel(i18n.t.bind(i18n))}
      </Text>
    );
  }

  return (
    <View style={{ alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center", marginTop: 4, gap: 2 }}>
      <Text
        style={{ color: colors.subtext, fontSize: 11, fontWeight: "700", textAlign }}
        numberOfLines={2}
      >
        {nameLine}
      </Text>
      {eraLine ? (
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700", textAlign }}>
          {eraLine}
        </Text>
      ) : null}
    </View>
  );
}

export default function MlbMatchupDetailRow({ g, colors, formatStandingsLine, colTime = 0 }) {
  const awayAbbr = String(g?.away?.abbr || "").toUpperCase();
  const homeAbbr = String(g?.home?.abbr || "").toUpperCase();
  const awayRecord = formatStandingsLine?.(awayAbbr) || null;
  const homeRecord = formatStandingsLine?.(homeAbbr) || null;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <View style={{ width: colTime }} />

      <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}>
        {awayRecord ? (
          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800" }}>{awayRecord}</Text>
        ) : null}
        <PitcherBlock pitcher={g?.awayProbablePitcher} colors={colors} align="left" />
      </View>

      <View style={{ width: 28 }} />

      <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
        {homeRecord ? (
          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800", textAlign: "right" }}>
            {homeRecord}
          </Text>
        ) : null}
        <PitcherBlock pitcher={g?.homeProbablePitcher} colors={colors} align="right" />
      </View>
    </View>
  );
}
