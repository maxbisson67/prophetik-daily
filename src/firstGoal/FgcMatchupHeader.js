import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import { useTeamStandingsLookup } from "@src/sports/useTeamStandingsLookup";
import {
  formatMlbPitcherEraLine,
  formatMlbPitcherFallbackLabel,
  formatMlbPitcherNameAndRecord,
} from "@src/mlb/mlbPitcherDisplayHelpers";

function PitcherBlock({ pitcher, colors }) {
  const nameLine = formatMlbPitcherNameAndRecord(pitcher);
  const eraLine = formatMlbPitcherEraLine(pitcher);

  if (!nameLine) {
    return (
      <Text
        style={{
          color: colors.subtext,
          fontSize: 11,
          fontWeight: "700",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        {formatMlbPitcherFallbackLabel(i18n.t.bind(i18n))}
      </Text>
    );
  }

  return (
    <View style={{ alignItems: "center", marginTop: 4, gap: 2 }}>
      <Text
        style={{ color: colors.subtext, fontSize: 11, fontWeight: "700", textAlign: "center" }}
        numberOfLines={2}
      >
        {nameLine}
      </Text>
      {eraLine ? (
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700", textAlign: "center" }}>
          {eraLine}
        </Text>
      ) : null}
    </View>
  );
}

function TeamColumn({
  abbr,
  league,
  recordLine,
  pitcher,
  colors,
  selected,
  onPress,
}) {
  const team = lookupTeamByAbbr(league, abbr);
  const isMlb = league === "MLB";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: selected ? colors.primary : "transparent",
        backgroundColor: selected ? colors.card2 : "transparent",
      }}
    >
      <TeamLogoBadge team={team} size={44} colors={colors} />
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{abbr}</Text>
      {recordLine ? (
        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
          {recordLine}
        </Text>
      ) : null}
      {isMlb ? <PitcherBlock pitcher={pitcher} colors={colors} /> : null}
    </TouchableOpacity>
  );
}

export default function FgcMatchupHeader({
  challenge,
  probablePitchers,
  selectedTeam,
  onSelectTeam,
  colors,
}) {
  const league = String(challenge?.league || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const away = String(challenge?.awayAbbr || "").trim().toUpperCase();
  const home = String(challenge?.homeAbbr || "").trim().toUpperCase();
  const { formatLine } = useTeamStandingsLookup(league);

  if (!away || !home) return null;

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginTop: 10,
        marginBottom: 4,
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "800", marginBottom: 10, paddingHorizontal: 4 }}>
        {i18n.t("firstGoal.pick.tapTeamToFilter", {
          defaultValue: "Choisis une équipe pour voir ses joueurs",
        })}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <TeamColumn
          abbr={away}
          league={league}
          recordLine={formatLine(away)}
          pitcher={probablePitchers?.away}
          colors={colors}
          selected={selectedTeam === away}
          onPress={() => onSelectTeam?.(away)}
        />

        <TeamColumn
          abbr={home}
          league={league}
          recordLine={formatLine(home)}
          pitcher={probablePitchers?.home}
          colors={colors}
          selected={selectedTeam === home}
          onPress={() => onSelectTeam?.(home)}
        />
      </View>
    </View>
  );
}
